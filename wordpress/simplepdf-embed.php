<?php
/*
Plugin Name: SimplePDF Embed
Description: Your visitors can fill & sign PDFs without leaving your website.
Plugin URI: https://simplePDF.eu/embed
Version: 1.0
Author: SimplePDF.eu
Author URI: https://simplePDF.eu
*/

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
    echo <<<HTML
      <i style="margin-left: 8px;">Links with the extension .pdf are opened with SimplePDF</i>
    HTML;
    echo '</div>';
}

function simplepdf_company_identifier_callback() {
    $value = get_option('simplepdf_company_identifier');
    echo '<input type="text" name="simplepdf_company_identifier" value="' . esc_attr($value) . '">';
    echo <<<HTML
    <p style="margin-top: 8px; margin-bottom: 8px"><b>Signup to get your own company identifier: <a href="https://simplePDF.eu/embed#wp" target="_blank">SimplePDF.eu/embed</a>.</b></p>
    <ul style="list-style: circle;padding-left: 20px;">
        <li><a href="https://simplepdf.eu/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank">Use your own branding and loading</a></li>
        <li><a href="https://simplepdf.eu/help/how-to/get-email-notifications-for-pdf-form-submissions#wp" target="_blank">Automatically receive the submissions in your inbox</a></li>
        <li><a href="https://simplepdf.eu/help/how-to/customize-the-pdf-editor-and-add-branding#wp" target="_blank">Customize the editor: show and hide fields</a></li>
    </ul>
    HTML;
}

function enqueue_simplepdf_script() {
  $company_identifier = get_option('simplepdf_company_identifier');
  $auto_open_pdf = get_option('simplepdf_auto_open_pdf');
  if ($auto_open_pdf) {
      echo '<script src="https://unpkg.com/@simplepdf/web-embed-pdf" companyIdentifier="' . esc_attr(empty($company_identifier) ? 'wordpress' : $company_identifier) . '" defer></script>';
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
