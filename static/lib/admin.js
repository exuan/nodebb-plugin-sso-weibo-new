define('admin/plugins/sso-weibo-new', ['settings'], function(Settings) {
	'use strict';
	/* globals $, app, socket, require */

	var ACP = {};

	ACP.init = function() {
		Settings.load('sso-weibo-new', $('.sso-weibo-new-settings'));

		$('#save').on('click', function() {
			Settings.save('sso-weibo-new', $('.sso-weibo-new-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'sso-weibo-new-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});