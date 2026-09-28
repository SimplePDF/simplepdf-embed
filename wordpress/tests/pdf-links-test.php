<?php
// The plugin's mirror of the web-embed link rule, checked against the cases the web package's own
// unit test asserts, plus the HTML shapes the settings page report must read correctly.
//   php wordpress/tests/pdf-links-test.php

define('SIMPLEPDF_TESTING', true);

// The one WordPress function the file under test calls; WordPress's own is this plus older-PHP fallbacks.
function wp_parse_url($url, $component = -1) {
    return parse_url($url, $component);
}

require __DIR__ . '/../svn/trunk/pdf-links.php';

$failures = array();
$check_count = 0;
$check = function ($label, $is_expected) use (&$failures, &$check_count) {
    $check_count++;
    if ( ! $is_expected ) {
        $failures[] = $label;
    }
};
$keep_href = function ($href) {
    return $href;
};

$cases = json_decode(file_get_contents(__DIR__ . '/fixtures/pdf-link-cases.json'), true);
$check('the shared link cases load', is_array($cases) && count($cases) > 0);
foreach ( $cases as $case ) {
    $opens_in_simplepdf = simplepdf_classify_link($case['href'], $case['classes']) === 'opens_in_simplepdf';
    $check("shared case {$case['href']} [" . implode(' ', $case['classes']) . ']', $opens_in_simplepdf === $case['opens_in_simplepdf']);
}

$commented_out = simplepdf_extract_pdf_links('<!-- <a href="/old-form.pdf">Old</a> --><p>No links</p>', $keep_href);
$check('a commented-out link is not counted', count($commented_out) === 0);

$greater_than_in_title = simplepdf_extract_pdf_links('<a title="Fill > download" href="/form.pdf">Form</a>', $keep_href);
$check('a > inside a quoted attribute does not end the tag', count($greater_than_in_title) === 1 && $greater_than_in_title[0]['href'] === '/form.pdf');

$resolved = simplepdf_extract_pdf_links('<a href="forms/intake.pdf">Intake</a>', function ($href) {
    return 'https://example.com/clinic/' . $href;
});
$check('the href is resolved by the caller before it is classified', $resolved[0]['href'] === 'https://example.com/clinic/forms/intake.pdf');

$excluded = simplepdf_extract_pdf_links('<a class="button exclude-simplepdf" href="/form.pdf">Print</a>', $keep_href);
$check('an excluded link is reported as excluded', $excluded[0]['link_type'] === 'excluded');

if ( ! empty($failures) ) {
    fwrite(STDERR, "FAILED:\n  " . implode("\n  ", $failures) . "\n");
    exit(1);
}
echo "pdf-links: {$check_count} checks passed\n";
