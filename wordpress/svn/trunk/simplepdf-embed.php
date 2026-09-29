<?php
/*
Plugin Name:       SimplePDF Embed
Plugin URI:        https://simplepdf.com/embed
Author:            SimplePDF
Author URI:        https://simplepdf.com
Description:       Visitors fill and sign your PDFs right on your site. With a SimplePDF account, every filled PDF comes back to you, automatically.
Version:           1.2.1
License:           GPL v2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
*/

if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/pdf-links.php';

define('SIMPLEPDF_PLUGIN_VERSION', '1.2.1');
define('SIMPLEPDF_SETTINGS_SCREEN', 'settings_page_simplepdf_settings');
define('SIMPLEPDF_POST_LIST_LIMIT', 300);
define('SIMPLEPDF_PDF_PAGE_LIMIT', 100);
define('SIMPLEPDF_PDF_TABLE_PAGE_SIZE', 20);
define('SIMPLEPDF_WEB_EMBED_VERSION', '1.9.0');
define('SIMPLEPDF_REVIEW_URL', 'https://wordpress.org/support/plugin/simplepdf-embed/reviews/#new-post');
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
    register_setting('simplepdf_account', 'simplepdf_company_identifier', array(
        'sanitize_callback' => 'simplepdf_sanitize_company_identifier',
    ));
    register_setting('simplepdf_scope', 'simplepdf_load_scope', array(
        'sanitize_callback' => 'simplepdf_sanitize_load_scope',
    ));
    register_setting('simplepdf_scope', 'simplepdf_selected_post_ids', array(
        'sanitize_callback' => 'simplepdf_sanitize_selected_post_ids',
    ));
    register_setting('simplepdf_scope', 'simplepdf_webmcp', array(
        'sanitize_callback' => 'simplepdf_sanitize_webmcp',
    ));
}

function simplepdf_normalize_company_identifier($value) {
    $subdomain = preg_replace('#^(?:https?://)?(?:[^/]*\.)?([a-z0-9-]+)\.simplepdf\.com.*$#i', '$1', trim((string) $value));

    return preg_replace('/[^a-z0-9-]/', '', strtolower($subdomain));
}

function simplepdf_sanitize_company_identifier($value) {
    $company_identifier = simplepdf_normalize_company_identifier($value);
    $is_subdomain_label = $company_identifier === '' || preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $company_identifier) === 1;
    if ( ! $is_subdomain_label ) {
        add_settings_error(
            'simplepdf_company_identifier',
            'simplepdf_invalid_company_identifier',
            __('That company identifier is not valid: use the first part of your SimplePDF address, for example acme for acme.simplepdf.com.', 'simplepdf-embed')
        );
        return get_option('simplepdf_company_identifier');
    }

    return $company_identifier;
}

function simplepdf_sanitize_load_scope($value) {
    return $value === 'selected' ? 'selected' : 'everywhere';
}

// An unticked checkbox posts nothing, which saves 'off'.
function simplepdf_sanitize_webmcp($value) {
    return $value === 'on' ? 'on' : 'off';
}

function simplepdf_is_webmcp_enabled() {
    return get_option('simplepdf_webmcp', 'on') === 'on';
}

function simplepdf_sanitize_selected_post_ids($value) {
    if ( ! is_array($value) ) {
        return array();
    }

    return array_values(array_unique(array_filter(array_map('absint', $value))));
}

function simplepdf_get_company_identifier() {
    return simplepdf_normalize_company_identifier(get_option('simplepdf_company_identifier'));
}

function simplepdf_fetch_account_status($company_identifier) {
    $response = wp_remote_head('https://' . $company_identifier . '.simplepdf.com/', array(
        'redirection' => 0,
        'timeout' => 5,
        'user-agent' => 'SimplePDF-WordPress/' . SIMPLEPDF_PLUGIN_VERSION,
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

    return $queried_object instanceof WP_Post && simplepdf_runs_on_post($queried_object->ID);
}

function simplepdf_enqueue_script() {
    if ( ! simplepdf_should_load_on_current_request() ) {
        return;
    }

    $script_src = plugin_dir_url(__FILE__) . 'build/web-embed-pdf.js';

    wp_enqueue_script('simplepdf-web-embed-pdf', $script_src, array(), SIMPLEPDF_WEB_EMBED_VERSION, true);

    $saved_company_identifier = simplepdf_get_company_identifier();
    $company_identifier = $saved_company_identifier === '' ? 'wordpress' : $saved_company_identifier;
    $webmcp_option = simplepdf_is_webmcp_enabled() ? '' : ', webMCP: { enabled: false }';
    $inline_script = "window.simplePDF.setConfig({ companyIdentifier: '" . esc_js($company_identifier) . "'" . $webmcp_option . ' });';

    wp_add_inline_script('simplepdf-web-embed-pdf', $inline_script, 'after');
}

function simplepdf_should_show_review_notice() {
    $company_identifier = simplepdf_get_company_identifier();

    $is_eligible = $company_identifier !== ''
        && ! get_option('simplepdf_review_notice_dismissed')
        && simplepdf_get_account_status($company_identifier) === 'found';
    if ( ! $is_eligible ) {
        return false;
    }

    $report = simplepdf_get_pdf_link_report();

    return $report['counts']['simplepdf'] > 0;
}

function simplepdf_enqueue_admin_assets($hook_suffix) {
    if ( $hook_suffix !== SIMPLEPDF_SETTINGS_SCREEN ) {
        return;
    }

    wp_register_style('simplepdf-settings', false, array(), SIMPLEPDF_PLUGIN_VERSION);
    wp_enqueue_style('simplepdf-settings');
    wp_add_inline_style('simplepdf-settings', simplepdf_admin_css());

    if ( ! simplepdf_should_show_review_notice() ) {
        return;
    }

    wp_register_script('simplepdf-review-notice', false, array(), SIMPLEPDF_PLUGIN_VERSION, true);
    wp_enqueue_script('simplepdf-review-notice');
    wp_add_inline_script('simplepdf-review-notice', simplepdf_review_notice_script());
}

function simplepdf_review_notice_script() {
    $dismiss_request = array(
        'url' => admin_url('admin-ajax.php'),
        'action' => 'simplepdf_dismiss_review_notice',
        'nonce' => wp_create_nonce('simplepdf_dismiss_review_notice'),
    );

    return 'const simplepdfReviewNotice = ' . wp_json_encode($dismiss_request) . ';' . <<<'JS'

document.addEventListener('click', (event) => {
  const notice = event.target.closest('.simplepdf-review-notice');
  const isDismissal = notice !== null && event.target.closest('.notice-dismiss, .simplepdf-review-link') !== null;
  if (!isDismissal) {
    return;
  }

  const body = new URLSearchParams({ action: simplepdfReviewNotice.action, _ajax_nonce: simplepdfReviewNotice.nonce });
  fetch(simplepdfReviewNotice.url, { method: 'POST', credentials: 'same-origin', body });
  if (event.target.closest('.simplepdf-review-link') !== null) {
    notice.remove();
  }
});
JS;
}

function simplepdf_render_review_notice() {
    $screen = get_current_screen();
    $is_settings_screen = $screen !== null && $screen->id === SIMPLEPDF_SETTINGS_SCREEN;
    if ( ! $is_settings_screen || ! simplepdf_should_show_review_notice() ) {
        return;
    }
    ?>
    <div class="notice notice-info is-dismissible simplepdf-review-notice">
        <p>
            <?php esc_html_e('Is SimplePDF bringing your filled PDFs back? A short review on WordPress.org helps other site owners find it.', 'simplepdf-embed'); ?>
            <a class="button button-small simplepdf-review-link" href="<?php echo esc_url(SIMPLEPDF_REVIEW_URL); ?>" target="_blank" rel="noopener">
                <?php esc_html_e('Leave a review', 'simplepdf-embed'); ?>
                <span class="screen-reader-text"><?php esc_html_e('(opens in a new tab)', 'simplepdf-embed'); ?></span>
            </a>
        </p>
    </div>
    <?php
}

function simplepdf_dismiss_review_notice() {
    check_ajax_referer('simplepdf_dismiss_review_notice');
    if ( ! current_user_can('manage_options') ) {
        wp_send_json_error(null, 403);
    }

    update_option('simplepdf_review_notice_dismissed', true, false);
    wp_send_json_success();
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
.simplepdf-card-attention .simplepdf-card-header, .simplepdf-card-welcome .simplepdf-card-header { margin: -20px -24px 16px; padding: 16px 24px 12px; border-top-left-radius: inherit; border-top-right-radius: inherit; }
.simplepdf-card-attention .simplepdf-card-header .simplepdf-lede, .simplepdf-card-welcome .simplepdf-card-header .simplepdf-lede { margin-bottom: 0; }
.simplepdf-card-attention .simplepdf-card-header { background: #fcf2e3; border-bottom: 1px solid #f2d5a4; }
.simplepdf-card-attention .simplepdf-card-header h2 { color: #6b3f00; }
.simplepdf-card-attention .simplepdf-card-header .simplepdf-lede { color: #50330d; }
.simplepdf-card-welcome .simplepdf-card-header { background: #eef3fd; border-bottom: 1px solid #c9d8f8; }
.simplepdf-card-welcome .simplepdf-card-header h2 { color: #1d3a8f; }
.simplepdf-card-welcome .simplepdf-card-header .simplepdf-lede { color: #243b6b; }
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
.simplepdf-get-started .button { margin-left: auto; min-width: 11rem; text-align: center; }
.simplepdf-pdf-table { margin-top: 12px; }
.simplepdf-pdf-pagination { margin: 8px 0 0; }
.simplepdf-pdf-table th:first-child { width: 35%; }
.simplepdf-pdf-table th:last-child { width: 30%; }
.simplepdf-pdf-table tbody + tbody { border-top: 1px solid #f0f0f1; }
.simplepdf-pdf-table tbody:nth-of-type(odd) { background: #f6f7f7; }
.simplepdf-pdf-table td { padding-top: 6px; padding-bottom: 6px; }
.simplepdf-pdf-table td .description { display: block; }
.simplepdf-edit-link { color: #a7aaad; }
.simplepdf-pill { flex: none; display: inline-block; min-width: 64px; padding: 1px 8px; border-radius: 999px; background: #f0f0f1; color: #50575e; font-size: 12px; text-align: center; }
.simplepdf-pill-on { background: #edfaef; color: #007017; }
.simplepdf-pill-error { background: #fcf0f1; color: #b32d2e; }
.simplepdf-save { margin: 16px 0 0; }
.simplepdf-webmcp { display: block; margin: 16px 0 0; }
.simplepdf-webmcp .description { display: block; margin: 2px 0 0 24px; }
.simplepdf-review-notice .button { margin-left: 8px; vertical-align: baseline; }
.simplepdf-help { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.simplepdf-help h3 { margin: 0 0 8px; font-size: 13px; }
.simplepdf-help ul { margin: 0; }
.simplepdf-help li { margin-bottom: 6px; }
@media (max-width: 782px) {
  .simplepdf-compare, .simplepdf-help { grid-template-columns: 1fr; }
  .simplepdf-header { flex-wrap: wrap; }
  .simplepdf-header nav { margin-left: 0; width: 100%; }
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
        <nav aria-label="<?php esc_attr_e('SimplePDF help', 'simplepdf-embed'); ?>">
            <?php echo wp_kses_post(simplepdf_external_link('https://simplepdf.com/help', __('Help center', 'simplepdf-embed'))); ?>
            <a href="mailto:support@simplepdf.com"><?php esc_html_e('Contact support', 'simplepdf-embed'); ?></a>
        </nav>
    </div>
    <hr class="wp-header-end">
    <?php
}

// What the Site Editor saves in wp_posts and shows on many pages at once, with the label format of each kind.
function simplepdf_site_part_label_formats() {
    return array(
        /* translators: %s: template title */
        'wp_template' => __('%s (template)', 'simplepdf-embed'),
        /* translators: %s: template part title, e.g. Header */
        'wp_template_part' => __('%s (template part)', 'simplepdf-embed'),
        /* translators: %s: synced pattern title */
        'wp_block' => __('%s (pattern)', 'simplepdf-embed'),
        /* translators: %s: navigation menu title */
        'wp_navigation' => __('%s (menu)', 'simplepdf-embed'),
    );
}

function simplepdf_is_site_part($post) {
    return array_key_exists($post->post_type, simplepdf_site_part_label_formats());
}

// A navigation link saves its URL as a block attribute, not as an <a> tag, wherever the block sits.
function simplepdf_get_navigation_link_html($blocks) {
    $link_html = '';
    foreach ( $blocks as $block ) {
        $is_navigation_link = in_array($block['blockName'], array('core/navigation-link', 'core/navigation-submenu'), true);
        $url = $is_navigation_link && isset($block['attrs']['url']) && is_string($block['attrs']['url']) ? $block['attrs']['url'] : '';
        $link_html .= $url === '' ? '' : '<a href="' . esc_attr($url) . '">';
        $link_html .= simplepdf_get_navigation_link_html($block['innerBlocks']);
    }

    return $link_html;
}

function simplepdf_get_linked_html($post) {
    $has_navigation_links = strpos($post->post_content, '<!-- wp:navigation-') !== false;

    return $has_navigation_links
        ? $post->post_content . simplepdf_get_navigation_link_html(parse_blocks($post->post_content))
        : $post->post_content;
}

function simplepdf_get_empty_block_references() {
    return array('template_part_slugs' => array(), 'navigation_ids' => array(), 'has_fallback_navigation' => false, 'pattern_ids' => array());
}

// The template parts, menus and patterns one block points to (not its inner blocks).
function simplepdf_get_own_block_references($block) {
    $attrs = $block['attrs'];
    $references = simplepdf_get_empty_block_references();
    switch ( $block['blockName'] ) {
        case 'core/template-part':
            $is_active_theme = ! isset($attrs['theme']) || $attrs['theme'] === get_stylesheet();
            $references['template_part_slugs'] = $is_active_theme && isset($attrs['slug']) ? array($attrs['slug']) : array();
            return $references;
        case 'core/navigation':
            // Without a menu and without its own links, the block shows the most recently published menu.
            $references['navigation_ids'] = isset($attrs['ref']) ? array((int) $attrs['ref']) : array();
            $references['has_fallback_navigation'] = ! isset($attrs['ref']) && empty($block['innerBlocks']);
            return $references;
        case 'core/block':
            $references['pattern_ids'] = isset($attrs['ref']) ? array((int) $attrs['ref']) : array();
            return $references;
        default:
            return $references;
    }
}

// The template parts, menus and patterns a list of blocks shows, wherever they sit in it.
function simplepdf_get_block_references($blocks) {
    $references = simplepdf_get_empty_block_references();
    foreach ( $blocks as $block ) {
        $references = simplepdf_merge_block_references($references, simplepdf_get_own_block_references($block));
        $references = simplepdf_merge_block_references($references, simplepdf_get_block_references($block['innerBlocks']));
    }

    return $references;
}

function simplepdf_merge_block_references($references, $more_references) {
    return array(
        'template_part_slugs' => array_values(array_unique(array_merge($references['template_part_slugs'], $more_references['template_part_slugs']))),
        'navigation_ids' => array_values(array_unique(array_merge($references['navigation_ids'], $more_references['navigation_ids']))),
        'has_fallback_navigation' => $references['has_fallback_navigation'] || $more_references['has_fallback_navigation'],
        'pattern_ids' => array_values(array_unique(array_merge($references['pattern_ids'], $more_references['pattern_ids']))),
    );
}

// Custom templates (the "Template" picker on a page) show only on the pages that use them.
function simplepdf_get_assigned_template_slugs() {
    global $wpdb;

    return $wpdb->get_col(
        "SELECT DISTINCT page_template.meta_value FROM {$wpdb->postmeta} page_template
        JOIN {$wpdb->posts} assigned_post ON assigned_post.ID = page_template.post_id
        WHERE page_template.meta_key = '_wp_page_template' AND assigned_post.post_status = 'publish'"
    );
}

function simplepdf_is_referenced_by_published_content($post_id) {
    global $wpdb;

    return (bool) $wpdb->get_var($wpdb->prepare(
        "SELECT 1 FROM {$wpdb->posts}
        WHERE post_type IN ('page', 'post') AND post_status = 'publish'
          AND (post_content LIKE %s OR post_content LIKE %s)
        LIMIT 1",
        '%' . $wpdb->esc_like('"ref":' . $post_id . '}') . '%',
        '%' . $wpdb->esc_like('"ref":' . $post_id . ',') . '%'
    ));
}

// The site parts the live site shows, resolved with core's own template lookup (theme files included): the templates
// in effect, the template parts they include, the menus their navigation blocks show (a navigation block without a
// menu shows the most recently published one), and the patterns inserted in any of these or in a published page.
function simplepdf_get_used_site_part_ids($site_parts) {
    $assigned_template_slugs = simplepdf_get_assigned_template_slugs();
    $used_templates = array_filter(get_block_templates(array(), 'wp_template'), function ($template) use ($assigned_template_slugs) {
        return empty($template->is_custom) || in_array($template->slug, $assigned_template_slugs, true);
    });
    $template_parts = get_block_templates(array(), 'wp_template_part');

    $used_ids = array();
    $shown_blocks = array();
    foreach ( $used_templates as $template ) {
        $used_ids[] = (int) $template->wp_id;
        $shown_blocks = array_merge($shown_blocks, parse_blocks($template->content));
    }
    foreach ( $site_parts as $site_part ) {
        $is_shown_pattern = $site_part->post_type === 'wp_block' && simplepdf_is_referenced_by_published_content($site_part->ID);
        $shown_blocks = $is_shown_pattern ? array_merge($shown_blocks, parse_blocks($site_part->post_content)) : $shown_blocks;
    }

    // Template parts can include template parts: follow them until no new one shows up.
    $references = simplepdf_get_block_references($shown_blocks);
    $followed_slugs = array();
    while ( count(array_diff($references['template_part_slugs'], $followed_slugs)) > 0 ) {
        $new_slugs = array_diff($references['template_part_slugs'], $followed_slugs);
        $followed_slugs = array_merge($followed_slugs, $new_slugs);
        foreach ( $template_parts as $template_part ) {
            if ( ! in_array($template_part->slug, $new_slugs, true) ) {
                continue;
            }
            $used_ids[] = (int) $template_part->wp_id;
            $references = simplepdf_merge_block_references($references, simplepdf_get_block_references(parse_blocks($template_part->content)));
        }
    }

    $fallback_navigation_ids = $references['has_fallback_navigation']
        ? get_posts(array('post_type' => 'wp_navigation', 'post_status' => 'publish', 'numberposts' => 1, 'orderby' => 'date', 'order' => 'DESC', 'fields' => 'ids'))
        : array();
    $used_ids = array_merge($used_ids, $references['navigation_ids'], $references['pattern_ids'], array_map('intval', $fallback_navigation_ids));
    foreach ( $site_parts as $site_part ) {
        $is_menu_in_a_page = $site_part->post_type !== 'wp_template' && $site_part->post_type !== 'wp_template_part'
            && simplepdf_is_referenced_by_published_content($site_part->ID);
        $used_ids[] = $is_menu_in_a_page ? $site_part->ID : 0;
    }

    return array_values(array_unique(array_filter($used_ids)));
}

// The Site Editor's saved parts that link a PDF: published, from the active theme (customized templates stay in wp_posts
// after a theme switch), and not unsynced patterns (only ever copied into posts). A handful of rows, so no cap.
function simplepdf_scan_site_parts() {
    global $wpdb;

    $site_part_types = array_keys(simplepdf_site_part_label_formats());
    $site_part_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT site_part.ID FROM {$wpdb->posts} site_part
        WHERE site_part.post_type IN (" . implode(', ', array_fill(0, count($site_part_types), '%s')) . ")
          AND site_part.post_status = 'publish'
          AND (site_part.post_content LIKE %s OR site_part.post_content LIKE %s)
          AND (
            site_part.post_type NOT IN ('wp_template', 'wp_template_part')
            OR site_part.ID IN (
              SELECT theme_relationship.object_id
              FROM {$wpdb->term_relationships} theme_relationship
              JOIN {$wpdb->term_taxonomy} theme_taxonomy ON theme_taxonomy.term_taxonomy_id = theme_relationship.term_taxonomy_id
              JOIN {$wpdb->terms} theme_term ON theme_term.term_id = theme_taxonomy.term_id
              WHERE theme_taxonomy.taxonomy = 'wp_theme' AND theme_term.slug = %s
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM {$wpdb->postmeta} sync_status
            WHERE sync_status.post_id = site_part.ID AND sync_status.meta_key = 'wp_pattern_sync_status' AND sync_status.meta_value = 'unsynced'
          )
        ORDER BY FIELD(site_part.post_type, " . implode(', ', array_fill(0, count($site_part_types), '%s')) . "), site_part.ID",
        array_merge($site_part_types, array(
            '%' . $wpdb->esc_like('.pdf') . '%',
            '%' . $wpdb->esc_like('simplepdf') . '%',
            get_stylesheet(),
        ), $site_part_types)
    ));
    if ( empty($site_part_ids) ) {
        return array();
    }

    $site_parts = get_posts(array(
        'post__in' => array_map('absint', $site_part_ids),
        'post_type' => $site_part_types,
        'post_status' => 'publish',
        'orderby' => 'post__in',
        'numberposts' => -1,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ));
    $used_site_part_ids = simplepdf_get_used_site_part_ids($site_parts);

    return array_values(array_filter($site_parts, function ($site_part) use ($used_site_part_ids) {
        return in_array($site_part->ID, $used_site_part_ids, true);
    }));
}

// What visitors can reach: published pages and posts, plus drafts or private pages picked in "Where it runs" to try it.
function simplepdf_scan_pages() {
    global $wpdb;

    $picked_post_ids = simplepdf_get_load_scope() === 'selected' ? simplepdf_get_selected_post_ids() : array();
    $picked_clause = empty($picked_post_ids)
        ? ''
        : " OR (post_status IN ('private', 'draft') AND ID IN (" . implode(', ', array_fill(0, count($picked_post_ids), '%d')) . '))';
    $page_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts}
        WHERE post_type IN ('page', 'post')
          AND (post_status = 'publish'" . $picked_clause . ")
          AND (post_content LIKE %s OR post_content LIKE %s)
        ORDER BY post_modified DESC, ID DESC
        LIMIT %d",
        array_merge($picked_post_ids, array(
            '%' . $wpdb->esc_like('.pdf') . '%',
            '%' . $wpdb->esc_like('simplepdf') . '%',
            SIMPLEPDF_PDF_PAGE_LIMIT,
        ))
    ));
    if ( empty($page_ids) ) {
        return array('pages' => array(), 'is_capped' => false);
    }

    $pages = get_posts(array(
        'post__in' => array_map('absint', $page_ids),
        'post_type' => array('page', 'post'),
        'post_status' => array('publish', 'private', 'draft'),
        'orderby' => 'post__in',
        'numberposts' => -1,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ));

    return array('pages' => $pages, 'is_capped' => count($page_ids) === SIMPLEPDF_PDF_PAGE_LIMIT);
}

function simplepdf_scan_pages_with_pdf_links() {
    $page_scan = simplepdf_scan_pages();

    $pages_with_pdf_links = array();
    foreach ( array_merge(simplepdf_scan_site_parts(), $page_scan['pages']) as $post ) {
        $page_url = simplepdf_is_site_part($post) ? home_url('/') : get_permalink($post);
        $pdf_links = simplepdf_extract_pdf_links(simplepdf_get_linked_html($post), function ($href) use ($page_url) {
            return $href === '' ? $href : WP_Http::make_absolute_url($href, $page_url);
        });
        if ( ! empty($pdf_links) ) {
            $pages_with_pdf_links[] = array('post' => $post, 'pdf_links' => $pdf_links);
        }
    }

    return array('pages' => $pages_with_pdf_links, 'is_capped' => $page_scan['is_capped']);
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

// 'runs' | 'not_picked' | 'picked_pages': whether the script loads where the link shows.
// A site part's ID is never picked, so under picked pages it opens wherever a picked page shows it.
function simplepdf_get_page_scope($post) {
    if ( simplepdf_runs_on_post($post->ID) ) {
        return 'runs';
    }
    if ( ! simplepdf_is_site_part($post) || empty(simplepdf_get_selected_post_ids()) ) {
        return 'not_picked';
    }

    return 'picked_pages';
}

function simplepdf_get_link_outcome($pdf_link, $page_scope, $has_missing_account) {
    switch ( $pdf_link['link_type'] ) {
        case 'opens_in_simplepdf':
            switch ( $page_scope ) {
                case 'runs':
                    return array('opens_in' => $has_missing_account ? 'error' : 'simplepdf', 'reason' => '');
                case 'picked_pages':
                    return array('opens_in' => $has_missing_account ? 'error' : 'picked_pages', 'reason' => '');
                case 'not_picked':
                    return array('opens_in' => 'browser', 'reason' => '');
                default:
                    return array('opens_in' => 'browser', 'reason' => '');
            }
        case 'excluded':
            return array('opens_in' => 'browser', 'reason' => __('The link has the exclude-simplepdf class', 'simplepdf-embed'));
        case 'not_recognised':
            return array('opens_in' => 'browser', 'reason' => __('The link does not point to a .pdf file', 'simplepdf-embed'));
        default:
            return array('opens_in' => 'browser', 'reason' => '');
    }
}

// '' for a site part that shows on many pages rather than at one address.
function simplepdf_get_view_url($post) {
    if ( ! simplepdf_is_site_part($post) ) {
        return $post->post_status === 'publish' ? get_permalink($post) : get_preview_post_link($post);
    }

    $is_posts_page = $post->post_type === 'wp_template' && $post->post_name === 'home' && get_option('show_on_front') === 'page';
    if ( $is_posts_page ) {
        $posts_page_url = get_permalink((int) get_option('page_for_posts'));

        return $posts_page_url === false ? '' : $posts_page_url;
    }
    $is_home_template = $post->post_type === 'wp_template' && in_array($post->post_name, array('home', 'front-page'), true);

    return $is_home_template ? home_url('/') : '';
}

function simplepdf_render_scan_scope_note($is_capped) {
    ?>
    <p class="description">
        <?php esc_html_e('Lists the PDF links visitors can reach in your pages, posts, Site Editor templates, patterns and menus, as of your saved settings. Links added by a page builder, a classic menu or a widget are not listed, and open the same way.', 'simplepdf-embed'); ?>
        <?php if ( $is_capped ) : ?>
            <?php
            echo esc_html(sprintf(
                /* translators: %d: how many recently edited pages and posts are checked */
                __('Only your %d most recently edited pages and posts were checked.', 'simplepdf-embed'),
                SIMPLEPDF_PDF_PAGE_LIMIT
            ));
            ?>
        <?php endif; ?>
    </p>
    <?php
}

function simplepdf_render_get_started() {
    ?>
    <div class="simplepdf-card-header">
        <h2><?php esc_html_e('Get started', 'simplepdf-embed'); ?></h2>
        <p class="simplepdf-lede"><?php esc_html_e('Link a PDF and visitors fill it right on your site.', 'simplepdf-embed'); ?></p>
    </div>
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
                <span class="description"><?php esc_html_e('Your page shows up here, with where each PDF opens.', 'simplepdf-embed'); ?></span>
            </span>
        </li>
    </ol>
    <?php
}

function simplepdf_render_opens_in_pill($opens_in) {
    switch ( $opens_in ) {
        case 'simplepdf':
            echo '<span class="simplepdf-pill simplepdf-pill-on">' . esc_html__('SimplePDF', 'simplepdf-embed') . '</span>';
            break;
        case 'picked_pages':
            echo '<span class="simplepdf-pill simplepdf-pill-on">' . esc_html__('Picked pages', 'simplepdf-embed') . '</span>';
            break;
        case 'error':
            echo '<span class="simplepdf-pill simplepdf-pill-error">' . esc_html__('Error', 'simplepdf-embed') . '</span>';
            break;
        case 'browser':
            echo '<span class="simplepdf-pill">' . esc_html__('Browser', 'simplepdf-embed') . '</span>';
            break;
        default:
            echo '<span class="simplepdf-pill">' . esc_html__('Browser', 'simplepdf-embed') . '</span>';
            break;
    }
}

function simplepdf_render_page_cell($post) {
    $view_url = simplepdf_get_view_url($post);
    $label = simplepdf_get_post_label($post);
    $edit_url = get_edit_post_link($post);
    echo $view_url === '' ? esc_html($label) : wp_kses_post(simplepdf_external_link($view_url, $label));
    if ( $edit_url !== null && $edit_url !== '' ) {
        echo ' <span class="simplepdf-edit-link">&middot;</span> <a href="' . esc_url($edit_url) . '">' . esc_html__('Edit', 'simplepdf-embed') . '</a>';
    }
}

// One row per PDF link; a page's name spans its links.
function simplepdf_render_pdf_table($pages_with_pdf_links) {
    ?>
    <table class="widefat simplepdf-pdf-table">
        <thead>
            <tr>
                <th scope="col"><?php esc_html_e('Page or template', 'simplepdf-embed'); ?></th>
                <th scope="col"><?php esc_html_e('PDF', 'simplepdf-embed'); ?></th>
                <th scope="col"><?php esc_html_e('Opens in', 'simplepdf-embed'); ?></th>
            </tr>
        </thead>
        <?php foreach ( $pages_with_pdf_links as $page ) : ?>
            <tbody>
                <?php foreach ( $page['pdf_links'] as $link_index => $pdf_link ) : ?>
                    <?php
                    $path = (string) wp_parse_url($pdf_link['href'], PHP_URL_PATH);
                    $file_name = $path !== '' ? wp_basename($path) : $pdf_link['href'];
                    ?>
                    <tr>
                        <?php if ( $link_index === 0 ) : ?>
                            <td rowspan="<?php echo esc_attr((string) count($page['pdf_links'])); ?>"><?php simplepdf_render_page_cell($page['post']); ?></td>
                        <?php endif; ?>
                        <td><?php echo wp_kses_post(simplepdf_external_link($pdf_link['href'], $file_name)); ?></td>
                        <td>
                            <?php simplepdf_render_opens_in_pill($pdf_link['outcome']['opens_in']); ?>
                            <?php if ( $pdf_link['outcome']['reason'] !== '' ) : ?>
                                <span class="description"><?php echo esc_html($pdf_link['outcome']['reason']); ?></span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        <?php endforeach; ?>
    </table>
    <?php
}

function simplepdf_get_pdf_link_report() {
    static $report = null;
    if ( $report === null ) {
        $report = simplepdf_build_pdf_link_report();
    }

    return $report;
}

function simplepdf_build_pdf_link_report() {
    $scan = simplepdf_get_pages_with_pdf_links();
    $company_identifier = simplepdf_get_company_identifier();
    $has_missing_account = $company_identifier !== '' && simplepdf_get_account_status($company_identifier) === 'not_found';
    $counts = array('simplepdf' => 0, 'picked_pages' => 0, 'browser' => 0, 'error' => 0);

    $pages = array();
    foreach ( $scan['pages'] as $page ) {
        $page_scope = simplepdf_get_page_scope($page['post']);
        $pdf_links = array();
        foreach ( $page['pdf_links'] as $pdf_link ) {
            $outcome = simplepdf_get_link_outcome($pdf_link, $page_scope, $has_missing_account);
            $counts[$outcome['opens_in']]++;
            $pdf_links[] = array_merge($pdf_link, array('outcome' => $outcome));
        }
        $pages[] = array('post' => $page['post'], 'page_scope' => $page_scope, 'pdf_links' => $pdf_links);
    }

    return array(
        'pages' => $pages,
        'is_capped' => $scan['is_capped'],
        'counts' => $counts,
        'link_count' => $counts['simplepdf'] + $counts['picked_pages'] + $counts['browser'] + $counts['error'],
        'account_address' => $company_identifier . '.simplepdf.com',
    );
}

function simplepdf_get_pdfs_card_header($report) {
    $counts = $report['counts'];
    $link_count = $report['link_count'];

    if ( $counts['error'] > 0 ) {
        return array(
            'needs_attention' => true,
            'title' => sprintf(
                /* translators: 1: PDF links that show an error, 2: all PDF links found */
                _n('%1$d of %2$d PDF link shows an error', '%1$d of %2$d PDF links show an error', $link_count, 'simplepdf-embed'),
                $counts['error'],
                $link_count
            ),
            'lede' => sprintf(
                /* translators: %s: the account address, e.g. acme.simplepdf.com */
                __('They open %s, which does not exist. Fix your company identifier below.', 'simplepdf-embed'),
                $report['account_address']
            ),
        );
    }

    $opening_count = $counts['simplepdf'] + $counts['picked_pages'];
    $title = sprintf(
        /* translators: 1: PDF links that open in SimplePDF, 2: all PDF links found */
        _n('%1$d of %2$d PDF link opens in SimplePDF', '%1$d of %2$d PDF links open in SimplePDF', $link_count, 'simplepdf-embed'),
        $opening_count,
        $link_count
    );
    $picked_count = count(simplepdf_get_selected_post_ids());

    switch ( simplepdf_get_load_scope() ) {
        case 'selected':
            if ( $picked_count === 0 ) {
                return array(
                    'needs_attention' => true,
                    'title' => $title,
                    'lede' => __('Nothing is picked in "Where it runs", so every PDF link opens in the browser. Pick a page, or choose Everywhere.', 'simplepdf-embed'),
                );
            }

            return array(
                'needs_attention' => $opening_count === 0,
                'title' => $title,
                'lede' => sprintf(
                    /* translators: %d: pages and posts picked in "Where it runs" */
                    _n('Runs on the %d page you picked. Every other PDF link opens in the browser.', 'Runs on the %d pages you picked. Every other PDF link opens in the browser.', $picked_count, 'simplepdf-embed'),
                    $picked_count
                ),
            );
        case 'everywhere':
            return array(
                'needs_attention' => $opening_count === 0,
                'title' => $title,
                'lede' => $opening_count === 0
                    ? __('None of these links opens in SimplePDF: the reason is next to each one.', 'simplepdf-embed')
                    : __('Open a page to see exactly what your visitors see.', 'simplepdf-embed'),
            );
        default:
            return array('needs_attention' => false, 'title' => $title, 'lede' => '');
    }
}

function simplepdf_get_pdf_table_page_url($table_page) {
    return add_query_arg('pdf_links_page', $table_page, menu_page_url('simplepdf_settings', false)) . '#simplepdf-pdf-links';
}

function simplepdf_render_pdf_table_pagination($table_page, $table_page_count, $row_count) {
    ?>
    <div class="tablenav bottom simplepdf-pdf-pagination">
        <div class="tablenav-pages">
            <span class="displaying-num">
                <?php
                echo esc_html(sprintf(
                    /* translators: %d: pages, posts, templates, patterns and menus in the PDF links table */
                    _n('%d item', '%d items', $row_count, 'simplepdf-embed'),
                    $row_count
                ));
                ?>
            </span>
            <span class="pagination-links">
                <?php if ( $table_page > 1 ) : ?>
                    <a class="prev-page button" href="<?php echo esc_url(simplepdf_get_pdf_table_page_url($table_page - 1)); ?>"><span class="screen-reader-text"><?php esc_html_e('Previous page', 'simplepdf-embed'); ?></span><span aria-hidden="true">&lsaquo;</span></a>
                <?php else : ?>
                    <span class="tablenav-pages-navspan button disabled" aria-hidden="true">&lsaquo;</span>
                <?php endif; ?>
                <span class="paging-input">
                    <?php
                    echo esc_html(sprintf(
                        /* translators: 1: current table page, 2: number of table pages */
                        __('%1$d of %2$d', 'simplepdf-embed'),
                        $table_page,
                        $table_page_count
                    ));
                    ?>
                </span>
                <?php if ( $table_page < $table_page_count ) : ?>
                    <a class="next-page button" href="<?php echo esc_url(simplepdf_get_pdf_table_page_url($table_page + 1)); ?>"><span class="screen-reader-text"><?php esc_html_e('Next page', 'simplepdf-embed'); ?></span><span aria-hidden="true">&rsaquo;</span></a>
                <?php else : ?>
                    <span class="tablenav-pages-navspan button disabled" aria-hidden="true">&rsaquo;</span>
                <?php endif; ?>
            </span>
        </div>
    </div>
    <?php
}

function simplepdf_render_pdfs_card() {
    $report = simplepdf_get_pdf_link_report();
    if ( $report['link_count'] === 0 ) {
        ?>
        <div class="card simplepdf-card-welcome">
            <?php simplepdf_render_get_started(); ?>
            <?php simplepdf_render_scan_scope_note($report['is_capped']); ?>
        </div>
        <?php
        return;
    }

    $header = simplepdf_get_pdfs_card_header($report);
    $row_count = count($report['pages']);
    $table_page_count = (int) ceil($row_count / SIMPLEPDF_PDF_TABLE_PAGE_SIZE);
    $requested_table_page = isset($_GET['pdf_links_page']) ? absint(wp_unslash($_GET['pdf_links_page'])) : 1;
    $table_page = min(max($requested_table_page, 1), $table_page_count);
    ?>
    <div id="simplepdf-pdf-links" class="card<?php echo $header['needs_attention'] ? ' simplepdf-card-attention' : ''; ?>">
        <div class="simplepdf-card-header">
            <h2><?php echo esc_html($header['title']); ?></h2>
            <p class="simplepdf-lede"><?php echo esc_html($header['lede']); ?></p>
        </div>
        <?php simplepdf_render_pdf_table(array_slice($report['pages'], ($table_page - 1) * SIMPLEPDF_PDF_TABLE_PAGE_SIZE, SIMPLEPDF_PDF_TABLE_PAGE_SIZE)); ?>
        <?php if ( $table_page_count > 1 ) : ?>
            <?php simplepdf_render_pdf_table_pagination($table_page, $table_page_count, $row_count); ?>
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
            <p class="description"><?php esc_html_e('We couldn\'t reach SimplePDF to confirm this account just now. We will check again in a few minutes.', 'simplepdf-embed'); ?></p>
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
        __('Export the form data to CSV or Excel', 'simplepdf-embed'),
    );
    $proof_points = array(
        __('Excel export', 'simplepdf-embed'),
        __('Email notifications', 'simplepdf-embed'),
        __('Required fields', 'simplepdf-embed'),
        __('Team dashboard', 'simplepdf-embed'),
        __('Webhooks', 'simplepdf-embed'),
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
    <form class="card" method="post" action="options.php">
        <?php settings_fields('simplepdf_account'); ?>
        <?php
        if ( $company_identifier === '' ) {
            simplepdf_render_account_pitch();
        } else {
            simplepdf_render_linked_account($company_identifier);
        }
        ?>
    </form>
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
    $all_pages = get_posts(array_merge($query_args, array('post_type' => 'page', 'numberposts' => -1)));
    $latest_posts = get_posts(array_merge($query_args, array('post_type' => 'post', 'numberposts' => SIMPLEPDF_POST_LIST_LIMIT)));
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
    foreach ( array_merge($pinned_posts, $all_pages, $latest_posts) as $post ) {
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
    if ( simplepdf_is_site_part($post) ) {
        $site_part_label_formats = simplepdf_site_part_label_formats();

        return sprintf($site_part_label_formats[$post->post_type], $label);
    }

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
    <form class="card simplepdf-scope" method="post" action="options.php">
        <?php settings_fields('simplepdf_scope'); ?>
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
                                /* translators: %d: how many of the latest posts are listed */
                                __('Every page is listed, and your %d latest posts.', 'simplepdf-embed'),
                                SIMPLEPDF_POST_LIST_LIMIT
                            ));
                            ?>
                        </p>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        </fieldset>
        <label class="simplepdf-webmcp">
            <input type="checkbox" name="simplepdf_webmcp" value="on" <?php checked(simplepdf_is_webmcp_enabled()); ?>>
            <strong><?php esc_html_e('Give AI assistants direct access to your forms (WebMCP)', 'simplepdf-embed'); ?></strong>
            <span class="description"><?php esc_html_e('Visitors browsing with ChatGPT\'s browser or Chrome with WebMCP can have it fill the PDF for them.', 'simplepdf-embed'); ?></span>
        </label>
        <p class="simplepdf-save"><?php submit_button(__('Save', 'simplepdf-embed'), 'secondary', 'simplepdf-save-scope', false); ?></p>
    </form>
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
        <?php simplepdf_render_pdfs_card(); ?>
        <?php simplepdf_render_scope_card(); ?>
        <?php simplepdf_render_account_card(); ?>
        <?php simplepdf_render_help_card(); ?>
    </div>
    <?php
}

add_action('admin_menu', 'simplepdf_settings_init');
add_action('admin_init', 'simplepdf_register_settings');
add_action('admin_enqueue_scripts', 'simplepdf_enqueue_admin_assets');
add_action('admin_notices', 'simplepdf_render_review_notice');
add_action('wp_ajax_simplepdf_dismiss_review_notice', 'simplepdf_dismiss_review_notice');
add_action('wp_enqueue_scripts', 'simplepdf_enqueue_script');
