(function (module) {
	"use strict";

	var user = module.parent.require('./user'),
		meta = module.parent.require('./meta'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
		passportWeibo = require('passport-weibo').Strategy,
		fs = module.parent.require('fs'),
		path = module.parent.require('path'),
		nconf = module.parent.require('nconf'),
		async = module.parent.require('async');

	var authenticationController = module.parent.require('./controllers/authentication');

	var constants = Object.freeze({
		'name': "weibo",
		'admin': {
			'route': '/plugins/sso-weibo-new',
			'icon': 'fa-weibo'
		}
	});

	var Weibo = {
		settings: undefined
	};

    Weibo.init = function (data, callback) {
		function render(req, res, next) {
			res.render('admin/plugins/sso-weibo-new', {});
		}

		data.router.get('/admin/plugins/sso-weibo-new', data.middleware.admin.buildHeader, render);
		data.router.get('/api/admin/plugins/sso-weibo-new', render);

		callback();
	};


    Weibo.getStrategy = function (strategies, callback) {
		meta.settings.get('sso-weibo-new', function (err, settings) {
			Weibo.settings = settings;
			if (!err && settings['key'] && settings['secret']) {
				passport.use(new passportWeibo({
                    clientID: settings['key'],
                    clientSecret: settings['secret'],
                    callbackURL: nconf.get('url') + '/auth/weibo/callback',
                    passReqToCallback: true
				}, function (req, accessToken, refreshToken, profile, done) {
					if (req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') && req.user.uid > 0) {
						user.setUserField(req.user.uid, 'wbid', profile.id);
						db.setObjectField('wbid:uid', profile.id, req.user.uid);
						return done(null, req.user);
					}

					Weibo.login(profile.id, profile.displayName, profile._raw.profile_image_url, function (err, user) {
						if (err) {
							return done(err);
						}

						authenticationController.onSuccessfulLogin(req, user.uid);
						done(null, user);
					});
				}));

				strategies.push({
					name: 'weibo',
					url: '/auth/weibo',
					callbackURL: '/auth/weibo/callback',
					icon: constants.admin.icon,
					scope: ''
				});

			}

			callback(null, strategies);
		});
	};

	Weibo.getAssociation = function (data, callback) {
		user.getUserField(data.uid, 'wbid', function (err, weiboId) {
			if (err) {
				return callback(err, data);
			}

            if (weiboId) {
				data.associations.push({
					associated: true,
					url: 'https://weibo.com/u/' + weiboId,
					name: constants.name,
					icon: constants.admin.icon
				});
			} else {
				data.associations.push({
					associated: false,
					url: nconf.get('url') + '/auth/weibo',
					name: constants.name,
					icon: constants.admin.icon
				});
			}

			callback(null, data);
		})
	};

	Weibo.login = function (wbid, username, photo, callback) {
		Weibo.getUidByWeiboId(wbid, function (err, uid) {
			if (err) {
				return callback(err);
			}

			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				user.create({username: username}, function (err, uid) {
					if (err) {
						return callback(err);
					}

					user.setUserField(uid, 'wbid', wbid);
					db.setObjectField('wbid:uid', wbid, uid);
					var autoConfirm = Weibo.settings && Weibo.settings.autoconfirm === "on" ? 1 : 0;
					user.setUserField(uid, 'email:confirmed', autoConfirm);
					// Save their photo, if present
					if (photo && photo.length > 0) {
						user.setUserField(uid, 'uploadedpicture', photo);
						user.setUserField(uid, 'picture', photo);
					}

					callback(null, {
						uid: uid
					});
				});
			}
		});
	};

	Weibo.getUidByWeiboId = function (wbid, callback) {
		db.getObjectField('wbid:uid', wbid, function (err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	Weibo.addMenu = function (custom_header, callback) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		callback(null, custom_header);
	};

	Weibo.deleteUser = function (uid, callback) {
		async.waterfall([
			async.apply(user.getUserField, uid, 'wbid'),
			function (oAuthIdToDelete, next) {
				console.log(uid);
		        console.log(oAuthIdToDelete);
				db.deleteObjectField('wbid:uid', oAuthIdToDelete, next);
			}
		], function (err) {
			console.log(err);
			if (err) {
				winston.error('[sso-weibo] Could not remove OAuthId data for uid ' + uid + '. Error: ' + err);
				return callback(err);
			}
			callback(null, uid);
		});
	};

	module.exports = Weibo;
}(module));
