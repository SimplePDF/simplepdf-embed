<?php
/*
Plugin Name:       SimplePDF Embed
Plugin URI:        https://simplepdf.com/embed
Author:            SimplePDF
Author URI:        https://simplepdf.com
Description:       Your visitors can fill & sign PDFs without leaving your website.
Version:           1.1.1
License:           GPL v2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
*/

if ( ! defined( 'ABSPATH' ) ) exit;

function simplepdf_settings_init() {
    add_option('simplepdf_auto_open_pdf', true);
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
        'SimplePDF Settings',
        'simplepdf_settings_section_callback',
        'simplepdf_settings'
    );

    add_settings_field(
        'simplepdf_auto_open_pdf',
        'Automatically open PDFs with SimplePDF',
        'simplepdf_auto_open_pdf_callback',
        'simplepdf_settings',
        'simplepdf_settings_section'
    );

    add_settings_field(
        'simplepdf_company_identifier',
        'Company Identifier',
        'simplepdf_company_identifier_callback',
        'simplepdf_settings',
        'simplepdf_settings_section'
    );

    register_setting('simplepdf_settings', 'simplepdf_auto_open_pdf');
    register_setting('simplepdf_settings', 'simplepdf_company_identifier');
}

function simplepdf_settings_section_callback() {
    echo '<p>Configure the SimplePDF Embed settings:</p>';
}

function simplepdf_auto_open_pdf_callback() {
    $value = get_option('simplepdf_auto_open_pdf');
    echo '<div style="display: flex; align-items: center;"><input type="checkbox" name="simplepdf_auto_open_pdf" value="1"' . checked(1, $value, false) . '>';
    echo '<i style="margin-left: 8px;">Links with the extension .pdf are opened with SimplePDF</i>';
    echo '</div>';
}

function simplepdf_company_identifier_callback() {
    $value = get_option('simplepdf_company_identifier');
    echo '<input type="text" name="simplepdf_company_identifier" value="' . esc_attr($value) . '">';
    echo '<p style="margin-top: 8px; margin-bottom: 8px"><b>Signup to get your own company identifier: <a href="https://simplepdf.com/embed#wp" target="_blank">SimplePDF/embed</a>.</b></p>';
    echo '<ul style="list-style: circle;padding-left: 20px;">';
    echo '<li><a href="https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank">Use your own branding and loading</a></li>';
    echo '<li><a href="https://simplepdf.com/help/how-to/get-email-notifications-for-pdf-form-submissions#wp" target="_blank">Automatically receive the submissions in your inbox</a></li>';
    echo '<li><a href="https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank">Customize the editor: show or hide specific fields</a></li>';
    echo '</ul>';
}

function enqueue_simplepdf_script() {

  $auto_open_pdf = get_option('simplepdf_auto_open_pdf');

  if ($auto_open_pdf) {
      $plugin_url = plugin_dir_url(__FILE__);
      $script_src = $plugin_url . 'build/web-embed-pdf.js';

      wp_enqueue_script('simplepdf-web-embed-pdf', $script_src, array(), '1.7.2', true);

      $company_identifier = get_option('simplepdf_company_identifier');
      $companyIdentifier = empty($company_identifier) ? 'wordpress' : $company_identifier;
      $inline_script = "window.simplePDF = {companyIdentifier: '" . esc_js($companyIdentifier) . "'};";

      wp_add_inline_script('simplepdf-web-embed-pdf', $inline_script, 'before');
  }
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
