<?php
/*
Plugin Name:       SimplePDF Embed
Plugin URI:        https://simplepdf.com/embed
Author:            SimplePDF
Author URI:        https://simplepdf.com
Description:       Your visitors can fill & sign PDFs without leaving your website.
Version:           1.1.3
License:           GPL v2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
*/

if ( ! defined( 'ABSPATH' ) ) exit;

define('SIMPLEPDF_PLUGIN_VERSION', '1.1.3');
define('SIMPLEPDF_SETTINGS_SCREEN', 'settings_page_simplepdf_settings');
define('SIMPLEPDF_POST_LIST_LIMIT', 300);
define('SIMPLEPDF_PDF_PAGE_LIMIT', 100);
define('SIMPLEPDF_WEB_EMBED_VERSION', '1.8.5');
define('SIMPLEPDF_PRICING_URL', 'https://simplepdf.com/pricing?ref=wordpress');

function simplepdf_settings_init() {
    add_submenu_page(
        'options-general.php',
        __('SimplePDF Embed Settings', 'simplepdf-embed'),
        __('SimplePDF Embed', 'simplepdf-embed'),
        'manage_options',
        'simplepdf_settings',
        'simplepdf_settings_page'
    );
}

function simplepdf_register_settings() {
    register_setting('simplepdf_settings', 'simplepdf_company_identifier', array(
        'sanitize_callback' => 'simplepdf_sanitize_company_identifier',
    ));
    register_setting('simplepdf_settings', 'simplepdf_load_scope', array(
        'sanitize_callback' => 'simplepdf_sanitize_load_scope',
    ));
    register_setting('simplepdf_settings', 'simplepdf_selected_post_ids', array(
        'sanitize_callback' => 'simplepdf_sanitize_selected_post_ids',
    ));
}

function simplepdf_sanitize_company_identifier($value) {
    $subdomain = preg_replace('#^(?:https?://)?(?:[^/]*\.)?([a-z0-9-]+)\.simplepdf\.com.*$#i', '$1', trim((string) $value));

    return preg_replace('/[^a-z0-9-]/', '', strtolower($subdomain));
}

function simplepdf_sanitize_load_scope($value) {
    return $value === 'selected' ? 'selected' : 'everywhere';
}

function simplepdf_sanitize_selected_post_ids($value) {
    if ( ! is_array($value) ) {
        return array();
    }

    return array_values(array_unique(array_filter(array_map('absint', $value))));
}

function simplepdf_get_company_identifier() {
    return simplepdf_sanitize_company_identifier(get_option('simplepdf_company_identifier'));
}

function simplepdf_fetch_account_status($company_identifier) {
    $response = wp_remote_head('https://' . $company_identifier . '.simplepdf.com/', array(
        'redirection' => 0,
        'timeout' => 5,
    ));
    if ( is_wp_error($response) ) {
        return 'unreachable';
    }

    $status_code = (int) wp_remote_retrieve_response_code($response);
    if ( $status_code === 404 ) {
        return 'not_found';
    }

    return $status_code >= 200 && $status_code < 400 ? 'found' : 'unreachable';
}

function simplepdf_get_account_status($company_identifier) {
    $cached_check = get_transient('simplepdf_account_check');
    $is_cached = is_array($cached_check)
        && isset($cached_check['company_identifier'], $cached_check['status'])
        && $cached_check['company_identifier'] === $company_identifier;
    if ( $is_cached ) {
        return $cached_check['status'];
    }

    $account_status = simplepdf_fetch_account_status($company_identifier);
    $cache_duration = $account_status === 'found' ? HOUR_IN_SECONDS : 5 * MINUTE_IN_SECONDS;
    set_transient('simplepdf_account_check', array(
        'company_identifier' => $company_identifier,
        'status' => $account_status,
    ), $cache_duration);

    return $account_status;
}

function simplepdf_get_load_scope() {
    return simplepdf_sanitize_load_scope(get_option('simplepdf_load_scope'));
}

function simplepdf_get_selected_post_ids() {
    return array_map('absint', (array) get_option('simplepdf_selected_post_ids', array()));
}

function simplepdf_should_load_on_current_request() {
    if ( simplepdf_get_load_scope() === 'everywhere' ) {
        return true;
    }

    $queried_object = get_queried_object();

    return $queried_object instanceof WP_Post
        && in_array($queried_object->ID, simplepdf_get_selected_post_ids(), true);
}

function simplepdf_enqueue_script() {
    if ( ! simplepdf_should_load_on_current_request() ) {
        return;
    }

    $script_src = plugin_dir_url(__FILE__) . 'build/web-embed-pdf.js';

    wp_enqueue_script('simplepdf-web-embed-pdf', $script_src, array(), SIMPLEPDF_WEB_EMBED_VERSION, true);

    $saved_company_identifier = simplepdf_get_company_identifier();
    $company_identifier = $saved_company_identifier === '' ? 'wordpress' : $saved_company_identifier;
    $inline_script = "window.simplePDF.setConfig({ companyIdentifier: '" . esc_js($company_identifier) . "' });";

    wp_add_inline_script('simplepdf-web-embed-pdf', $inline_script, 'after');
}

function simplepdf_enqueue_admin_styles($hook_suffix) {
    if ( $hook_suffix !== SIMPLEPDF_SETTINGS_SCREEN ) {
        return;
    }

    wp_register_style('simplepdf-settings', false, array(), SIMPLEPDF_PLUGIN_VERSION);
    wp_enqueue_style('simplepdf-settings');
    wp_add_inline_style('simplepdf-settings', simplepdf_admin_css());
}
function simplepdf_admin_css() {
    return <<<CSS
.simplepdf-settings { max-width: 880px; }
.simplepdf-header { display: flex; align-items: center; gap: 12px; margin: 16px 0 8px; }
.simplepdf-header img { width: 32px; height: 32px; border-radius: 6px; }
.simplepdf-header h1 { padding: 0; margin: 0; }
.simplepdf-header .simplepdf-version { color: #646970; }
.simplepdf-header nav { margin-left: auto; display: flex; gap: 16px; }
.simplepdf-settings .card { max-width: none; padding: 20px 24px; margin-top: 16px; }
.simplepdf-settings .card h2 { margin: 0 0 8px; font-size: 16px; }
.simplepdf-settings .card > p:last-child { margin-bottom: 0; }
.simplepdf-card-attention { border-left: 4px solid #dba617; }
.simplepdf-lede { font-size: 14px; color: #3c434a; }
.simplepdf-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0 12px; }
.simplepdf-compare > div { border-radius: 6px; padding: 12px 16px; }
.simplepdf-compare h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
.simplepdf-compare ol { margin: 0 0 0 18px; }
.simplepdf-compare li { margin-bottom: 4px; }
.simplepdf-compare-before { background: #f6f7f7; color: #50575e; }
.simplepdf-compare-after { background: #edfaef; box-shadow: inset 0 0 0 1px #00a32a; }
.simplepdf-compare-after h3 { color: #007017; }
.simplepdf-punchline { font-size: 14px; font-weight: 600; }
.simplepdf-proof { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.simplepdf-proof li { margin: 0; padding: 2px 10px; border-radius: 999px; background: #f0f0f1; font-size: 12px; }
.simplepdf-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 20px 0 4px; }
.simplepdf-cta .button-hero { font-size: 14px; }
.simplepdf-cta-note { color: #646970; }
.simplepdf-status { display: flex; align-items: center; gap: 8px; font-size: 14px; margin: 12px 0; }
.simplepdf-status-connected::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #00a32a; }
.simplepdf-next-steps { margin: 0 0 0 18px; list-style: disc; }
.simplepdf-settings details { margin-top: 12px; }
.simplepdf-settings summary { cursor: pointer; color: var(--wp-admin-theme-color, #2271b1); }
.simplepdf-settings details[open] summary { margin-bottom: 8px; }
.simplepdf-identifier input { min-width: 264px; }
.simplepdf-scope fieldset > label { display: block; margin-bottom: 12px; }
.simplepdf-scope fieldset .description { display: block; margin: 2px 0 0 24px; }
.simplepdf-post-list { max-height: 240px; overflow-y: auto; border: 1px solid #dcdcde; border-radius: 4px; padding: 8px 12px; margin: 4px 0 0 24px; }
.simplepdf-post-list h3 { font-size: 13px; margin: 8px 0 4px; color: #646970; }
.simplepdf-post-list label { display: block; margin-bottom: 4px; }
.simplepdf-scope:has(input[value="everywhere"]:checked) .simplepdf-post-list { display: none; }
.simplepdf-get-started { counter-reset: simplepdf-step; list-style: none; margin: 16px 0 0; }
.simplepdf-get-started li { counter-increment: simplepdf-step; display: flex; align-items: center; gap: 12px; margin: 0; padding: 12px 0; border-top: 1px solid #f0f0f1; }
.simplepdf-get-started li:first-child { border-top: 0; }
.simplepdf-get-started li::before { content: counter(simplepdf-step); flex: none; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #f0f0f1; font-weight: 600; }
.simplepdf-step-text { display: flex; flex-direction: column; gap: 2px; }
.simplepdf-get-started .button { margin-left: auto; }
.simplepdf-pdf-table { margin-top: 12px; }
.simplepdf-pdf-table td:first-child { width: 30%; }
.simplepdf-pdf-links { margin: 0; }
.simplepdf-pdf-links li { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.simplepdf-link-text .description, .simplepdf-page-note { display: block; }
.simplepdf-pill { flex: none; display: inline-block; min-width: 64px; padding: 1px 8px; border-radius: 999px; background: #f0f0f1; color: #50575e; font-size: 12px; text-align: center; }
.simplepdf-pill-on { background: #edfaef; color: #007017; }
.simplepdf-pill-error { background: #fcf0f1; color: #b32d2e; }
.simplepdf-save { margin: 16px 0 0; }
.simplepdf-help { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.simplepdf-help h3 { margin: 0 0 8px; font-size: 13px; }
.simplepdf-help ul { margin: 0; }
.simplepdf-help li { margin-bottom: 6px; }
@media (max-width: 782px) {
  .simplepdf-compare, .simplepdf-help { grid-template-columns: 1fr; }
  .simplepdf-header nav { display: none; }
}
CSS;
}

function simplepdf_external_link($url, $label) {
    return sprintf(
        '<a href="%s" target="_blank" rel="noopener">%s <span aria-hidden="true">↗</span><span class="screen-reader-text">%s</span></a>',
        esc_url($url),
        esc_html($label),
        esc_html__('(opens in a new tab)', 'simplepdf-embed')
    );
}

function simplepdf_render_header() {
    ?>
    <div class="simplepdf-header">
        <img src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/icon-128x128.png'); ?>" alt="">
        <h1><?php esc_html_e('SimplePDF Embed', 'simplepdf-embed'); ?></h1>
        <span class="simplepdf-version">v<?php echo esc_html(SIMPLEPDF_PLUGIN_VERSION); ?></span>
        <nav>
            <?php echo wp_kses_post(simplepdf_external_link('https://simplepdf.com/help', __('Help center', 'simplepdf-embed'))); ?>
            <a href="mailto:support@simplepdf.com"><?php esc_html_e('Contact support', 'simplepdf-embed'); ?></a>
        </nav>
    </div>
    <hr class="wp-header-end">
    <?php
}

function simplepdf_get_anchor_attribute($anchor_tag, $attribute_name) {
    $attribute_pattern = '/\s' . $attribute_name . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i';
    if ( ! preg_match($attribute_pattern, $anchor_tag, $attribute_match) ) {
        return '';
    }

    $attribute_value = implode('', array_slice($attribute_match, 1));

    return trim(html_entity_decode($attribute_value, ENT_QUOTES));
}

// Mirrors getSimplePDFElements in the bundled web-embed script, so the table predicts what visitors get
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

function simplepdf_extract_pdf_links($post_content) {
    preg_match_all('/<a\s[^>]*>/i', $post_content, $anchor_matches);

    $pdf_links = array();
    foreach ( $anchor_matches[0] as $anchor_tag ) {
        $href = simplepdf_get_anchor_attribute($anchor_tag, 'href');
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

function simplepdf_scan_pages_with_pdf_links() {
    global $wpdb;

    $post_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts}
        WHERE post_type IN ('page', 'post')
          AND post_status IN ('publish', 'private', 'draft')
          AND (post_content LIKE %s OR post_content LIKE %s)
        ORDER BY post_modified DESC
        LIMIT %d",
        '%' . $wpdb->esc_like('.pdf') . '%',
        '%' . $wpdb->esc_like('simplepdf') . '%',
        SIMPLEPDF_PDF_PAGE_LIMIT
    ));
    if ( empty($post_ids) ) {
        return array('pages' => array(), 'is_capped' => false);
    }

    $posts = get_posts(array(
        'post__in' => array_map('absint', $post_ids),
        'post_type' => array('page', 'post'),
        'post_status' => array('publish', 'private', 'draft'),
        'orderby' => 'post__in',
        'numberposts' => -1,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ));

    $pages = array();
    foreach ( $posts as $post ) {
        $pdf_links = simplepdf_extract_pdf_links($post->post_content);
        if ( ! empty($pdf_links) ) {
            $pages[] = array('post' => $post, 'pdf_links' => $pdf_links);
        }
    }

    return array(
        'pages' => $pages,
        'is_capped' => count($post_ids) === SIMPLEPDF_PDF_PAGE_LIMIT,
    );
}

function simplepdf_get_pages_with_pdf_links() {
    static $pages_with_pdf_links = null;
    if ( $pages_with_pdf_links === null ) {
        $pages_with_pdf_links = simplepdf_scan_pages_with_pdf_links();
    }

    return $pages_with_pdf_links;
}

function simplepdf_runs_on_post($post_id) {
    return simplepdf_get_load_scope() === 'everywhere'
        || in_array($post_id, simplepdf_get_selected_post_ids(), true);
}

function simplepdf_get_link_outcome($pdf_link, $runs_on_page, $has_missing_account) {
    switch ( $pdf_link['link_type'] ) {
        case 'opens_in_simplepdf':
            if ( ! $runs_on_page ) {
                return array('opens_in' => 'browser', 'reason' => '');
            }

            return array('opens_in' => $has_missing_account ? 'error' : 'simplepdf', 'reason' => '');
        case 'excluded':
            return array('opens_in' => 'browser', 'reason' => __('The link has the exclude-simplepdf class', 'simplepdf-embed'));
        case 'not_recognised':
            return array('opens_in' => 'browser', 'reason' => __('The link does not point to a .pdf file', 'simplepdf-embed'));
        default:
            return array('opens_in' => 'browser', 'reason' => '');
    }
}

function simplepdf_get_view_url($post) {
    return $post->post_status === 'publish' ? get_permalink($post) : get_preview_post_link($post);
}

function simplepdf_render_scan_scope_note($is_capped) {
    ?>
    <p class="description">
        <?php esc_html_e('Lists the PDF links written in your pages and posts, as of your saved settings. Links added by a page builder, a menu or a widget are not listed, and open the same way.', 'simplepdf-embed'); ?>
        <?php if ( $is_capped ) : ?>
            <?php
            echo esc_html(sprintf(
                /* translators: %d: how many recently edited pages are scanned */
                __('Showing your %d most recently edited pages.', 'simplepdf-embed'),
                SIMPLEPDF_PDF_PAGE_LIMIT
            ));
            ?>
        <?php endif; ?>
    </p>
    <?php
}

function simplepdf_render_get_started() {
    ?>
    <h2><?php esc_html_e('No PDF links found in your pages and posts', 'simplepdf-embed'); ?></h2>
    <p class="simplepdf-lede"><?php esc_html_e('Visitors can\'t fill your forms on your site until you link a PDF. It takes two minutes:', 'simplepdf-embed'); ?></p>
    <ol class="simplepdf-get-started">
        <li>
            <span class="simplepdf-step-text">
                <strong><?php esc_html_e('Upload your PDF', 'simplepdf-embed'); ?></strong>
                <span class="description"><?php esc_html_e('Any PDF works, fillable or not.', 'simplepdf-embed'); ?></span>
            </span>
            <a class="button" href="<?php echo esc_url(admin_url('media-new.php')); ?>"><?php esc_html_e('Upload a PDF', 'simplepdf-embed'); ?></a>
        </li>
        <li>
            <span class="simplepdf-step-text">
                <strong><?php esc_html_e('Link to it from a page or post', 'simplepdf-embed'); ?></strong>
                <span class="description"><?php esc_html_e('Like any other link. Nothing else to add.', 'simplepdf-embed'); ?></span>
            </span>
            <a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=page')); ?>"><?php esc_html_e('Go to your pages', 'simplepdf-embed'); ?></a>
        </li>
        <li>
            <span class="simplepdf-step-text">
                <strong><?php esc_html_e('Come back here', 'simplepdf-embed'); ?></strong>
                <span class="description"><?php esc_html_e('The page shows up in this list, with where each PDF opens.', 'simplepdf-embed'); ?></span>
            </span>
        </li>
    </ol>
    <?php
}

function simplepdf_render_pdf_link_item($pdf_link) {
    $path = (string) wp_parse_url($pdf_link['href'], PHP_URL_PATH);
    $file_name = $path !== '' ? wp_basename($path) : $pdf_link['href'];
    ?>
    <li>
        <?php
        switch ( $pdf_link['outcome']['opens_in'] ) {
            case 'simplepdf':
                echo '<span class="simplepdf-pill simplepdf-pill-on">' . esc_html__('SimplePDF', 'simplepdf-embed') . '</span>';
                break;
            case 'error':
                echo '<span class="simplepdf-pill simplepdf-pill-error">' . esc_html__('Error', 'simplepdf-embed') . '</span>';
                break;
            default:
                echo '<span class="simplepdf-pill">' . esc_html__('Browser', 'simplepdf-embed') . '</span>';
                break;
        }
        ?>
        <span class="simplepdf-link-text">
            <?php echo wp_kses_post(simplepdf_external_link($pdf_link['href'], $file_name)); ?>
            <?php if ( $pdf_link['outcome']['reason'] !== '' ) : ?>
                <span class="description"><?php echo esc_html($pdf_link['outcome']['reason']); ?></span>
            <?php endif; ?>
        </span>
    </li>
    <?php
}

function simplepdf_render_pdf_table($pages_with_pdf_links) {
    ?>
    <table class="widefat striped simplepdf-pdf-table">
        <thead>
            <tr>
                <th scope="col"><?php esc_html_e('Page', 'simplepdf-embed'); ?></th>
                <th scope="col"><?php esc_html_e('PDF links and where they open', 'simplepdf-embed'); ?></th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ( $pages_with_pdf_links as $page ) : ?>
                <tr>
                    <td>
                        <?php echo wp_kses_post(simplepdf_external_link(simplepdf_get_view_url($page['post']), simplepdf_get_post_label($page['post']))); ?>
                        <?php if ( ! $page['runs_on_page'] ) : ?>
                            <span class="description simplepdf-page-note"><?php esc_html_e('Not picked in "Where it runs"', 'simplepdf-embed'); ?></span>
                        <?php endif; ?>
                        <div class="row-actions visible">
                            <a href="<?php echo esc_url(get_edit_post_link($page['post'])); ?>"><?php esc_html_e('Edit', 'simplepdf-embed'); ?></a>
                        </div>
                    </td>
                    <td>
                        <ul class="simplepdf-pdf-links">
                            <?php foreach ( $page['pdf_links'] as $pdf_link ) : ?>
                                <?php simplepdf_render_pdf_link_item($pdf_link); ?>
                            <?php endforeach; ?>
                        </ul>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    <?php
}

function simplepdf_get_pdf_link_report() {
    $scan = simplepdf_get_pages_with_pdf_links();
    $company_identifier = simplepdf_get_company_identifier();
    $has_missing_account = $company_identifier !== '' && simplepdf_get_account_status($company_identifier) === 'not_found';
    $counts = array('simplepdf' => 0, 'browser' => 0, 'error' => 0);

    $pages = array();
    foreach ( $scan['pages'] as $page ) {
        $runs_on_page = simplepdf_runs_on_post($page['post']->ID);
        $pdf_links = array();
        foreach ( $page['pdf_links'] as $pdf_link ) {
            $outcome = simplepdf_get_link_outcome($pdf_link, $runs_on_page, $has_missing_account);
            $counts[$outcome['opens_in']]++;
            $pdf_links[] = array_merge($pdf_link, array('outcome' => $outcome));
        }
        $pages[] = array('post' => $page['post'], 'runs_on_page' => $runs_on_page, 'pdf_links' => $pdf_links);
    }

    return array(
        'pages' => $pages,
        'is_capped' => $scan['is_capped'],
        'counts' => $counts,
        'link_count' => array_sum($counts),
        'account_address' => $company_identifier . '.simplepdf.com',
    );
}

function simplepdf_render_pdfs_card() {
    $report = simplepdf_get_pdf_link_report();
    $counts = $report['counts'];
    $link_count = $report['link_count'];
    $needs_attention = $counts['error'] > 0 || ($link_count > 0 && $counts['simplepdf'] === 0);
    ?>
    <div class="card<?php echo $needs_attention ? ' simplepdf-card-attention' : ''; ?>">
        <?php if ( $link_count === 0 ) : ?>
            <?php simplepdf_render_get_started(); ?>
        <?php elseif ( $counts['error'] > 0 ) : ?>
            <h2>
                <?php
                echo esc_html(sprintf(
                    /* translators: 1: PDF links that show an error, 2: all PDF links found */
                    _n('%1$d of %2$d PDF link shows an error', '%1$d of %2$d PDF links show an error', $link_count, 'simplepdf-embed'),
                    $counts['error'],
                    $link_count
                ));
                ?>
            </h2>
            <p class="simplepdf-lede">
                <?php
                echo esc_html(sprintf(
                    /* translators: %s: the account address, e.g. acme.simplepdf.com */
                    __('They open %s, which does not exist. Fix your company identifier below.', 'simplepdf-embed'),
                    $report['account_address']
                ));
                ?>
            </p>
        <?php else : ?>
            <h2>
                <?php
                echo esc_html(sprintf(
                    /* translators: 1: PDF links that open in SimplePDF, 2: all PDF links found */
                    _n('%1$d of %2$d PDF link opens in SimplePDF', '%1$d of %2$d PDF links open in SimplePDF', $link_count, 'simplepdf-embed'),
                    $counts['simplepdf'],
                    $link_count
                ));
                ?>
            </h2>
            <?php if ( $counts['simplepdf'] === 0 ) : ?>
                <p class="simplepdf-lede"><?php esc_html_e('Your PDF links open in the browser, not in SimplePDF. Switch "Where it runs" to Everywhere, or pick these pages.', 'simplepdf-embed'); ?></p>
            <?php else : ?>
                <p class="simplepdf-lede"><?php esc_html_e('Open a page to see exactly what your visitors see.', 'simplepdf-embed'); ?></p>
            <?php endif; ?>
        <?php endif; ?>
        <?php if ( $link_count > 0 ) : ?>
            <?php simplepdf_render_pdf_table($report['pages']); ?>
        <?php endif; ?>
        <?php simplepdf_render_scan_scope_note($report['is_capped']); ?>
    </div>
    <?php
}

function simplepdf_render_identifier_field() {
    ?>
    <p class="simplepdf-identifier">
        <label for="simplepdf_company_identifier"><?php esc_html_e('Company identifier', 'simplepdf-embed'); ?></label><br>
        <input
            type="text"
            id="simplepdf_company_identifier"
            name="simplepdf_company_identifier"
            placeholder="acme"
            value="<?php echo esc_attr(simplepdf_get_company_identifier()); ?>"
        >
    </p>
    <p class="description"><?php esc_html_e('It is the first part of your SimplePDF address: for acme.simplepdf.com, enter acme.', 'simplepdf-embed'); ?></p>
    <p class="simplepdf-save"><?php submit_button(__('Save identifier', 'simplepdf-embed'), 'secondary', 'simplepdf-save-identifier', false); ?></p>
    <?php
}

function simplepdf_render_account_next_steps($account_address) {
    ?>
    <ul class="simplepdf-next-steps">
        <li><?php echo wp_kses_post(simplepdf_external_link('https://' . $account_address . '/account/documents', __('Open your dashboard', 'simplepdf-embed'))); ?></li>
        <li><?php echo wp_kses_post(simplepdf_external_link('https://simplepdf.com/help/how-to/get-email-notifications-for-pdf-form-submissions', __('Turn on email alerts for your forms', 'simplepdf-embed'))); ?></li>
        <li><?php echo wp_kses_post(simplepdf_external_link('https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions', __('Send filled PDFs to your own systems with a webhook', 'simplepdf-embed'))); ?></li>
    </ul>
    <?php
}

function simplepdf_render_linked_account($company_identifier) {
    $account_address = $company_identifier . '.simplepdf.com';
    $account_status = simplepdf_get_account_status($company_identifier);

    switch ( $account_status ) {
        case 'found':
            ?>
            <h2><?php esc_html_e('Filled PDFs come back to your SimplePDF account', 'simplepdf-embed'); ?></h2>
            <p class="simplepdf-status simplepdf-status-connected"><strong><?php echo esc_html($account_address); ?></strong></p>
            <?php simplepdf_render_account_next_steps($account_address); ?>
            <details>
                <summary><?php esc_html_e('Change identifier', 'simplepdf-embed'); ?></summary>
                <?php simplepdf_render_identifier_field(); ?>
            </details>
            <?php
            return;
        case 'not_found':
            ?>
            <h2><?php esc_html_e('Check your company identifier', 'simplepdf-embed'); ?></h2>
            <div class="notice notice-error inline">
                <p>
                    <?php
                    echo esc_html(sprintf(
                        /* translators: %s: the account address, e.g. acme.simplepdf.com */
                        __('There is no SimplePDF account at %s, so visitors can\'t open your PDFs. Check the spelling below.', 'simplepdf-embed'),
                        $account_address
                    ));
                    ?>
                </p>
            </div>
            <?php simplepdf_render_identifier_field(); ?>
            <?php
            return;
        default:
            ?>
            <h2><?php esc_html_e('Filled PDFs come back to your SimplePDF account', 'simplepdf-embed'); ?></h2>
            <p class="simplepdf-status"><strong><?php echo esc_html($account_address); ?></strong></p>
            <p class="description"><?php esc_html_e('We couldn\'t reach SimplePDF to confirm this account just now. We will check again next time you open this page.', 'simplepdf-embed'); ?></p>
            <?php simplepdf_render_account_next_steps($account_address); ?>
            <details>
                <summary><?php esc_html_e('Change identifier', 'simplepdf-embed'); ?></summary>
                <?php simplepdf_render_identifier_field(); ?>
            </details>
            <?php
            return;
    }
}

function simplepdf_render_account_pitch() {
    $before_steps = array(
        __('A visitor fills and signs your PDF', 'simplepdf-embed'),
        __('They download it', 'simplepdf-embed'),
        __('They email it to you, if they remember', 'simplepdf-embed'),
        __('You save it and retype the answers', 'simplepdf-embed'),
    );
    $after_steps = array(
        __('A visitor fills and signs your PDF', 'simplepdf-embed'),
        __('They click Submit', 'simplepdf-embed'),
        __('The PDF lands in your dashboard, with an email alert if you want one', 'simplepdf-embed'),
        __('Export every answer to CSV or Excel', 'simplepdf-embed'),
    );
    $proof_points = array(
        __('Required fields', 'simplepdf-embed'),
        __('Webhooks', 'simplepdf-embed'),
        __('Team dashboard (5 seats)', 'simplepdf-embed'),
    );
    ?>
    <h2><?php esc_html_e('Get every filled PDF back, automatically', 'simplepdf-embed'); ?></h2>
    <div class="simplepdf-compare">
        <div class="simplepdf-compare-before">
            <h3><?php esc_html_e('Today', 'simplepdf-embed'); ?></h3>
            <ol>
                <?php foreach ( $before_steps as $step ) : ?>
                    <li><?php echo esc_html($step); ?></li>
                <?php endforeach; ?>
            </ol>
        </div>
        <div class="simplepdf-compare-after">
            <h3><?php esc_html_e('With a SimplePDF account', 'simplepdf-embed'); ?></h3>
            <ol>
                <?php foreach ( $after_steps as $step ) : ?>
                    <li><?php echo esc_html($step); ?></li>
                <?php endforeach; ?>
            </ol>
        </div>
    </div>
    <p class="simplepdf-punchline"><?php esc_html_e('Same PDF, same page. No chasing.', 'simplepdf-embed'); ?></p>
    <ul class="simplepdf-proof">
        <?php foreach ( $proof_points as $proof_point ) : ?>
            <li><?php echo esc_html($proof_point); ?></li>
        <?php endforeach; ?>
    </ul>
    <p class="description"><?php esc_html_e('On Pro and above: your logo in the editor, and filled PDFs saved to your own storage (S3 or Azure Blob Storage on Pro, SharePoint on Premium).', 'simplepdf-embed'); ?></p>
    <div class="simplepdf-cta">
        <a class="button button-primary button-hero" href="<?php echo esc_url(SIMPLEPDF_PRICING_URL); ?>" target="_blank" rel="noopener">
            <?php esc_html_e('Get filled PDFs back', 'simplepdf-embed'); ?>
            <span class="screen-reader-text"><?php esc_html_e('(opens in a new tab)', 'simplepdf-embed'); ?></span>
        </a>
        <span class="simplepdf-cta-note"><?php esc_html_e('7-day free trial · Cancel anytime', 'simplepdf-embed'); ?></span>
    </div>
    <details>
        <summary><?php esc_html_e('I already have an account', 'simplepdf-embed'); ?></summary>
        <?php simplepdf_render_identifier_field(); ?>
    </details>
    <?php
}

function simplepdf_render_account_card() {
    $company_identifier = simplepdf_get_company_identifier();
    ?>
    <div class="card">
        <?php
        if ( $company_identifier === '' ) {
            simplepdf_render_account_pitch();
        } else {
            simplepdf_render_linked_account($company_identifier);
        }
        ?>
    </div>
    <?php
}

function simplepdf_get_selectable_posts() {
    $query_args = array(
        'post_type' => array('page', 'post'),
        'post_status' => array('publish', 'private', 'draft'),
        'orderby' => 'date',
        'order' => 'DESC',
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    );
    $latest_posts = get_posts(array_merge($query_args, array('numberposts' => SIMPLEPDF_POST_LIST_LIMIT)));
    $pinned_post_ids = array_values(array_unique(array_merge(
        simplepdf_get_selected_post_ids(),
        array_map(function ($page) {
            return $page['post']->ID;
        }, simplepdf_get_pages_with_pdf_links()['pages'])
    )));
    $pinned_posts = empty($pinned_post_ids)
        ? array()
        : get_posts(array_merge($query_args, array('post__in' => $pinned_post_ids, 'numberposts' => -1)));

    $posts_by_id = array();
    foreach ( array_merge($pinned_posts, $latest_posts) as $post ) {
        $posts_by_id[$post->ID] = $post;
    }

    return array(
        'posts' => array_values($posts_by_id),
        'is_capped' => count($latest_posts) === SIMPLEPDF_POST_LIST_LIMIT,
    );
}

function simplepdf_get_post_label($post) {
    $title = wp_strip_all_tags(get_the_title($post));
    $label = $title !== '' ? $title : __('(no title)', 'simplepdf-embed');

    switch ( $post->post_status ) {
        case 'draft':
            /* translators: %s: page or post title */
            return sprintf(__('%s (draft)', 'simplepdf-embed'), $label);
        case 'private':
            /* translators: %s: page or post title */
            return sprintf(__('%s (private)', 'simplepdf-embed'), $label);
        default:
            return $label;
    }
}

function simplepdf_render_post_checklist($posts, $selected_post_ids, $post_type, $heading) {
    $posts_of_type = array_filter($posts, function ($post) use ($post_type) {
        return $post->post_type === $post_type;
    });
    if ( empty($posts_of_type) ) {
        return;
    }
    ?>
    <h3><?php echo esc_html($heading); ?></h3>
    <?php foreach ( $posts_of_type as $post ) : ?>
        <label>
            <input
                type="checkbox"
                name="simplepdf_selected_post_ids[]"
                value="<?php echo esc_attr($post->ID); ?>"
                <?php checked(in_array($post->ID, $selected_post_ids, true)); ?>
            >
            <?php echo esc_html(simplepdf_get_post_label($post)); ?>
        </label>
    <?php endforeach;
}

function simplepdf_render_scope_card() {
    $load_scope = simplepdf_get_load_scope();
    $selectable_posts = simplepdf_get_selectable_posts();
    $selected_post_ids = simplepdf_get_selected_post_ids();
    ?>
    <div class="card simplepdf-scope">
        <h2><?php esc_html_e('Where it runs', 'simplepdf-embed'); ?></h2>
        <fieldset>
            <legend class="screen-reader-text"><?php esc_html_e('Where it runs', 'simplepdf-embed'); ?></legend>
            <label>
                <input type="radio" name="simplepdf_load_scope" value="everywhere" <?php checked($load_scope, 'everywhere'); ?>>
                <strong><?php esc_html_e('Everywhere', 'simplepdf-embed'); ?></strong> <?php esc_html_e('(recommended)', 'simplepdf-embed'); ?>
                <span class="description"><?php esc_html_e('Every PDF link on your site opens in SimplePDF.', 'simplepdf-embed'); ?></span>
            </label>
            <label>
                <input type="radio" name="simplepdf_load_scope" value="selected" <?php checked($load_scope, 'selected'); ?>>
                <strong><?php esc_html_e('Only on pages and posts I pick', 'simplepdf-embed'); ?></strong>
                <span class="description"><?php esc_html_e('Try it on one page before going live, even a draft or private one. Other PDF links keep opening in the browser.', 'simplepdf-embed'); ?></span>
            </label>
            <div class="simplepdf-post-list">
                <?php if ( empty($selectable_posts['posts']) ) : ?>
                    <p><?php esc_html_e('No pages or posts yet.', 'simplepdf-embed'); ?></p>
                <?php else : ?>
                    <?php simplepdf_render_post_checklist($selectable_posts['posts'], $selected_post_ids, 'page', __('Pages', 'simplepdf-embed')); ?>
                    <?php simplepdf_render_post_checklist($selectable_posts['posts'], $selected_post_ids, 'post', __('Posts', 'simplepdf-embed')); ?>
                    <?php if ( $selectable_posts['is_capped'] ) : ?>
                        <p class="description">
                            <?php
                            echo esc_html(sprintf(
                                /* translators: %d: how many of the latest pages and posts are listed */
                                __('Showing your %d latest pages and posts.', 'simplepdf-embed'),
                                SIMPLEPDF_POST_LIST_LIMIT
                            ));
                            ?>
                        </p>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        </fieldset>
        <p class="simplepdf-save"><?php submit_button(__('Save', 'simplepdf-embed'), 'secondary', 'simplepdf-save-scope', false); ?></p>
    </div>
    <?php
}

function simplepdf_help_sections() {
    return array(
        array(
            'heading' => __('Build your form', 'simplepdf-embed'),
            'links' => array(
                'how-to/convert-pdf-to-fillable-form' => __('Turn any PDF into a fillable form', 'simplepdf-embed'),
                'how-to/add-required-fields-on-pdf-forms' => __('Make fields required', 'simplepdf-embed'),
                'how-to/customize-the-pdf-editor-and-add-branding' => __('Add your logo and branding', 'simplepdf-embed'),
                'how-to/customize-the-submission-confirmation' => __('Customize the confirmation page', 'simplepdf-embed'),
            ),
        ),
        array(
            'heading' => __('Receive filled PDFs', 'simplepdf-embed'),
            'links' => array(
                'how-to/get-email-notifications-for-pdf-form-submissions' => __('Email alerts', 'simplepdf-embed'),
                'how-to/configure-webhooks-pdf-form-submissions' => __('Webhooks', 'simplepdf-embed'),
                'how-to/how-to-organize-pdf-documents-with-tags' => __('Organize them with tags', 'simplepdf-embed'),
                'how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions' => __('Your own storage: S3', 'simplepdf-embed'),
                'how-to/bring-your-own-azure-blob-storage-for-pdf-storage' => __('Your own storage: Azure Blob Storage', 'simplepdf-embed'),
                'how-to/connect-sharepoint-as-your-own-storage-for-pdf-submissions' => __('Your own storage: SharePoint', 'simplepdf-embed'),
            ),
        ),
        array(
            'heading' => __('Plans and compliance', 'simplepdf-embed'),
            'links' => array(
                'faq/whats-included-in-basic' => __('What\'s in Basic', 'simplepdf-embed'),
                'faq/whats-included-in-pro' => __('What\'s in Pro', 'simplepdf-embed'),
                'faq/whats-included-in-premium' => __('What\'s in Premium', 'simplepdf-embed'),
                'faq/is-simplepdf-hipaa-compliant' => __('Is SimplePDF HIPAA compliant?', 'simplepdf-embed'),
            ),
        ),
    );
}

function simplepdf_render_help_card() {
    ?>
    <div class="card">
        <h2><?php esc_html_e('Guides', 'simplepdf-embed'); ?></h2>
        <div class="simplepdf-help">
            <?php foreach ( simplepdf_help_sections() as $section ) : ?>
                <div>
                    <h3><?php echo esc_html($section['heading']); ?></h3>
                    <ul>
                        <?php foreach ( $section['links'] as $article_path => $label ) : ?>
                            <li><?php echo wp_kses_post(simplepdf_external_link('https://simplepdf.com/help/' . $article_path, $label)); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
}

function simplepdf_settings_page() {
    if ( ! current_user_can('manage_options') ) {
        return;
    }
    ?>
    <div class="wrap simplepdf-settings">
        <?php simplepdf_render_header(); ?>
        <form method="post" action="options.php">
            <?php settings_fields('simplepdf_settings'); ?>
            <?php simplepdf_render_pdfs_card(); ?>
            <?php simplepdf_render_scope_card(); ?>
            <?php simplepdf_render_account_card(); ?>
        </form>
        <?php simplepdf_render_help_card(); ?>
    </div>
    <?php
}

add_action('admin_menu', 'simplepdf_settings_init');
add_action('admin_init', 'simplepdf_register_settings');
add_action('admin_enqueue_scripts', 'simplepdf_enqueue_admin_styles');
add_action('wp_enqueue_scripts', 'simplepdf_enqueue_script');
