<?php
if ( ! defined('WP_UNINSTALL_PLUGIN') ) exit;

delete_option('simplepdf_company_identifier');
delete_option('simplepdf_load_scope');
delete_option('simplepdf_selected_post_ids');
delete_option('simplepdf_review_notice_dismissed');
delete_transient('simplepdf_account_check');
