<?php
/*
Plugin Name:       SimplePDF Embed
Plugin URI:        https://simplepdf.com/embed
Author:            SimplePDF
Author URI:        https://simplepdf.com
Description:       Your visitors can fill & sign PDFs without leaving your website.
Version:           1.1.2
License:           GPL v2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
*/

if ( ! defined( 'ABSPATH' ) ) exit;

function simplepdf_settings_init() {
    add_option('simplepdf_company_identifier');

    add_submenu_page(
        'options-general.php',
        'SimplePDF Embed Settings',
        'SimplePDF Embed',
        'manage_options',
        'simplepdf_settings',
        'simplepdf_settings_page'
    );


    add_settings_section(
        'simplepdf_settings_section',
        '',
        'simplepdf_settings_section_callback',
        'simplepdf_settings'
    );

    add_settings_field(
        'simplepdf_company_identifier',
        'Company Identifier',
        'simplepdf_company_identifier_callback',
        'simplepdf_settings',
        'simplepdf_settings_section'
    );

    register_setting('simplepdf_settings', 'simplepdf_company_identifier');
}

function simplepdf_settings_section_callback() {
    echo '';
}

function simplepdf_company_identifier_callback() {
    $value = get_option('simplepdf_company_identifier');
    echo '<input type="text" style="min-width: 264px;"name="simplepdf_company_identifier" placeholder="Enter your unique company identifier" value="' . esc_attr($value) . '">';
    echo '<p style="margin-top: 8px; margin-bottom: 8px"><b>Unlock Exclusive Features - Get Your Company Identifier Now:</b> Dive deeper at <a href="https://simplepdf.com/embed#wp" target="_blank" style="color: #0077cc; text-decoration: underline;">SimplePDF/embed</a></p>';
    echo '<ul style="list-style: disc; padding-left: 20px; font-weight: 500;">';
    echo '<li><a href="https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank" style="color: #0077cc;">Brand Your PDF Experience - Add Your Own Logo and Loading Animation</a></li>';
    echo '<li><a href="https://simplepdf.com/help/how-to/get-email-notifications-for-pdf-form-submissions#wp" target="_blank" style="color: #0077cc;">Instant Delivery - Get Edited Documents Directly in Your Inbox</a></li>';
    echo '<li><a href="https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank" style="color: #0077cc;">Tailor Your PDF Editor - Control What Users See and Edit</a></li>';
    echo '</ul>';
    echo '<p style="font-style: italic; color: #666;">Have questions? Reach out for personalized support at <b><a href="mailto:support@simplepdf.com" style="color: #0077cc;">support@simplepdf.com</a></b> - We\'re here to help you succeed!</p>';
}

function enqueue_simplepdf_script() {

  $plugin_url = plugin_dir_url(__FILE__);
  $script_src = $plugin_url . 'build/web-embed-pdf.js';

  wp_enqueue_script('simplepdf-web-embed-pdf', $script_src, array(), '1.8.2', true);

  $company_identifier = get_option('simplepdf_company_identifier');
  $companyIdentifier = empty($company_identifier) ? 'wordpress' : $company_identifier;
  $inline_script = "window.simplePDF.setConfig({ companyIdentifier: '" . esc_js($companyIdentifier) . "' });";

  wp_add_inline_script('simplepdf-web-embed-pdf', $inline_script, 'after');
}

function simplepdf_settings_page() {
    ?>
    <div class="wrap">
        <h1>SimplePDF Embed Settings</h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('simplepdf_settings');
            do_settings_sections('simplepdf_settings');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}

add_action('admin_menu', 'simplepdf_settings_init');
add_action('wp_enqueue_scripts', 'enqueue_simplepdf_script');
?>
