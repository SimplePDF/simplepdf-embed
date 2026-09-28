<?php
// Which links in a page's HTML the bundled web-embed script opens in SimplePDF, for the settings
// page's "PDFs on your site" report. No WordPress call beyond wp_parse_url, so a test can load it.

if ( ! defined( 'ABSPATH' ) && ! defined( 'SIMPLEPDF_TESTING' ) ) exit;

// A tag attribute's value, whichever quoting the author used.
function simplepdf_get_anchor_attribute($anchor_tag, $attribute_name) {
    $attribute_pattern = '/\s' . $attribute_name . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i';
    if ( ! preg_match($attribute_pattern, $anchor_tag, $attribute_match) ) {
        return '';
    }

    $attribute_value = implode('', array_slice($attribute_match, 1));

    return trim(html_entity_decode($attribute_value, ENT_QUOTES));
}

// Mirrors getSimplePDFElements in the bundled web-embed script, so the report predicts what visitors get.
// The web package's shared link cases pin both rules (wordpress/tests/pdf-links-test.php).
// CF: src/shared.ts
function simplepdf_classify_link($href, $classes) {
    if ( in_array('exclude-simplepdf', $classes, true) ) {
        return 'excluded';
    }

    $is_pdf_link = substr(strtolower($href), -4) === '.pdf'
        || substr(strtolower((string) wp_parse_url($href, PHP_URL_PATH)), -4) === '.pdf';
    $is_simplepdf_link = preg_match('#^https://[^.]+\.simplepdf\.com(/[^/]+)?/(form|documents)/.+#', $href) === 1;
    if ( $is_pdf_link || $is_simplepdf_link || in_array('simplepdf', $classes, true) ) {
        return 'opens_in_simplepdf';
    }

    return 'not_recognised';
}

// Every rendered `<a>` tag: commented-out markup is dropped, and a `>` inside a quoted attribute
// does not end the tag.
function simplepdf_find_anchor_tags($html) {
    $rendered_html = preg_replace('/<!--.*?-->/s', '', $html);
    preg_match_all('/<a\s(?:[^>"\']|"[^"]*"|\'[^\']*\')*>/i', (string) $rendered_html, $anchor_matches);

    return $anchor_matches[0];
}

// The PDF links of a page, each href resolved the way the visitor's browser resolves it
// ($resolve_href turns a relative href into the absolute URL the script sees).
function simplepdf_extract_pdf_links($html, $resolve_href) {
    $pdf_links = array();
    foreach ( simplepdf_find_anchor_tags($html) as $anchor_tag ) {
        $href = call_user_func($resolve_href, simplepdf_get_anchor_attribute($anchor_tag, 'href'));
        $classes = preg_split('/\s+/', simplepdf_get_anchor_attribute($anchor_tag, 'class'), -1, PREG_SPLIT_NO_EMPTY);
        $link_type = simplepdf_classify_link($href, $classes);
        $mentions_pdf = stripos($href, '.pdf') !== false;
        if ( $link_type === 'not_recognised' && ! $mentions_pdf ) {
            continue;
        }

        $pdf_links[] = array(
            'href' => $href,
            'link_type' => $link_type,
        );
    }

    return $pdf_links;
}
