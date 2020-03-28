var myAppModule = angular.module('App', ['ngToast', 'ui.bootstrap', 'ngMaterial', 'ngMessages', 'ngCookies', 'ngRoute', 'angularSpinners', 'configModule', 'pascalprecht.translate']);

myAppModule.config(['$httpProvider', '$routeProvider', '$translateProvider', function($httpProvider, $routeProvider, $translateProvider) {
        $httpProvider.defaults.useXDomain = true;
        $httpProvider.defaults.withCredentials = true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];

        $routeProvider
            .when("/users", {
                templateUrl: "templates/users.html"
            })
            .when("/games/:gameId", {
                templateUrl: "templates/game.html",
                controller: 'GameCtrl'
            })
            .when("/games/:gameId/currentRound", {
                templateUrl: "templates/round.html",
                controller: 'roundController'
            })
            .otherwise({
                templateUrl: "templates/overview.html",
                controller: 'overviewController'
            });

        $translateProvider
        .useStaticFilesLoader({
            prefix: './translations/',
            suffix: '.json'
        });
        $translateProvider.preferredLanguage('de');
    }
]);

myAppModule.service('AuthService', function($http, CONFIG){
    this.checkUniqueValue = function(property, value) {
        return $http.get(CONFIG.API_ENDPOINT + "/users/checkUnique", {'params':{'key': property, 'value':value}}).then( function(result) {
            return result.data.unique;
        });
    }
});

myAppModule.directive("ngUnique", function(AuthService) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attrs, ngModel) {
            element.bind('blur', function (e) {
            if (!ngModel || !element.val()) return;
                var keyProperty = scope.$eval(attrs.ngUnique);
                var currentValue = element.val();
                AuthService.checkUniqueValue(keyProperty.property, currentValue)
                    .then(function (unique) {
                        if (currentValue == element.val()) {
                            ngModel.$setValidity('unique', unique);
                            scope.$broadcast('show-errors-check-validity');
                        }
                });
            });
        }
    }
});

myAppModule.directive("compareTo", function() {
   return {
       require: "ngModel",
       scope: {
           otherModelValue: "=compareTo"
       },
       link: function(scope, element, attributes, ngModel) {

           ngModel.$validators.compareTo = function(modelValue) {
               return modelValue === scope.otherModelValue;
           };

           scope.$watch("otherModelValue", function() {
               ngModel.$validate();
           });
       }
   };
});


myAppModule.run(function($translate, $cookies, COOKIE_KEYS) {
    $translate.use($cookies.getObject(COOKIE_KEYS.LANGUAGE));
});


myAppModule.controller('roundController', function ($scope, $interval, $rootScope, $uibModal, $http, $sce, ngToast, $location, $routeParams, $timeout, $cookies, CONFIG, COOKIE_KEYS, spinnerService, $translate) {

    $scope.gameId = $routeParams.gameId;

    $scope.showInfoToast = function(message) {
        ngToast.create(message);
    };

    $scope.showErrorToast = function(message){
        ngToast.danger({
            content: $sce.trustAsHtml('<div class="error-toast">' + message + '</div>'),
            timeout: 10000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.playCard = function(card) {
        var body = {"card":card.key}
        $http.post(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + '/currentRound/playcard', JSON.stringify(body), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
           .success(function(response) {
               $scope.showInfoToast("Card '" + card.value + "' played !");
               $scope.refreshData();
           })
           .catch(function(response) {
               $scope.showErrorToast(response.data);
           })
           .finally(function () {
           });
    };

    $scope.refreshCards = function () {
        $scope.loadCards();
    };

    $scope.initRound = function () {
        $scope.loadRound();
        $scope.loadCards();
        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + "/teams")
            .then(function(response) {
                $scope.teams = response.data;
            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.showErrorToast(text);
                });
            }
        );
        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId)
            .then(function(response) {
                $scope.gameName = response.data.game_name;
            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.showErrorToast(text);
                });
            }
        );
}

    $scope.getLastCardPlayed = function() {
        if( ! $scope.currentRound )
            return "None"
        return $scope.currentRound.last_card_played || "None"
    }

    $scope.refreshData = function () {
        $scope.loadRound();
        $scope.loadCards();
    };

    $scope.loadRound = function() {
        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + "/currentRound")
            .then(function(response) {
                $scope.currentRound = response.data;
            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.showErrorToast(text);
                    $scope.stopPolling();
                });
            }
        );
    };

    $scope.loadCards = function() {
        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + "/currentRound/set")
            .then(function(response) {
                $scope.currentSet = response.data;
            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.showErrorToast(text);
                    $scope.stopPolling();
                });
            }
        );
    };

    $scope.refreshDataInterval = $interval($scope.refreshData, 2000);

    $scope.stopPolling = function() {
        $interval.cancel($scope.refreshDataInterval);
    };

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      $scope.stopPolling();
    });

    $scope.isAuthenticated = function() {
        return $cookies.get(COOKIE_KEYS.AUTHENTICATED);
    };

});


myAppModule.controller('GameCtrl', function ($scope, $interval, $rootScope, $uibModal, $http, $sce, ngToast, $location, $routeParams, $timeout, $cookies, CONFIG, COOKIE_KEYS, spinnerService, $translate) {

    $scope.gameId = $routeParams.gameId;

    $scope.showInfoToast = function(message) {
        ngToast.create(message);
    };

    $scope.showErrorToast = function(message){
        ngToast.danger({
            content: $sce.trustAsHtml('<div class="error-toast">' + message + '</div>'),
            timeout: 10000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.loadGame = function(gameId) {
        $http.get(CONFIG.API_ENDPOINT + '/games/' + gameId)
            .then(function(response) {
                $scope.currentGame = response.data;
                if( $scope.currentGame.game_state == "in_progress")
                    $location.path("/games/" + gameId + "/currentRound")
            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.stopPolling();
                });
            }
        );
    };

    $scope.showGameOverview = function() {
        if ( ! $scope.currentGame )
            return false;
        return $scope.isAuthenticated() && $scope.currentGame.players.indexOf($rootScope.currentUser.id) >= 0;
    };

    $scope.showBuildTeamsButton = function() {
        if ( ! $scope.currentGame )
                return false;
        return $scope.isAuthenticated() && $scope.currentGame.players_joined == 4 && $scope.currentGame.game_admin == $rootScope.currentUser.id;
    }

    $scope.showBuildTeams = function() {

        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + "/buildteams")
                .then(function(response) {

                    $rootScope.players = $scope.currentGame.players;
                    $rootScope.buildTeamsModal = $uibModal.open({
                        templateUrl: "./templates/modal/build-teams-modal.html",
                        controller: "GameCtrl"
                    });

                }, function() {
                    $translate('cannotLoadEvents').then(function (text) {
                        $scope.showErrorToast(text);
                    });
                }
            );
    }

    $scope.buildTeams = function() {
        $http.post(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + '/teams', JSON.stringify($scope.teams), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
           .success(function(response) {
               $translate('eventAdded').then(function (text) {
                   $scope.showInfoToast(text + "!");
               });
               $rootScope.buildTeamsModal.close("Teams built");
               $scope.startGame();
           })
           .catch(function(response) {
               $translate('cannotAddEvent').then(function (text) {
                   if( response.data.error.code ){
                       $translate(response.data.error.code).then(function (errorCodeTranslation) {
                           $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                       });
                   } else {
                       $scope.showErrorToast(text + "!");
                   }
               });
           })
           .finally(function () {
           });

    }


    $scope.startGame = function() {
        $http.get(CONFIG.API_ENDPOINT + '/games/' + $scope.gameId + "/start")
            .then(function(response) {

                $location.path("/games/" + gameId + "/currentRound")

            }, function() {
                $translate('cannotLoadEvents').then(function (text) {
                    $scope.showErrorToast(text);
                });
            }
        );

    }

    $scope.refreshGame = function () {
        $scope.loadGame($scope.gameId);
    };

    $scope.refreshGameInterval = $interval($scope.refreshGame, 5000);

    $scope.stopPolling = function() {
        $interval.cancel($scope.refreshGameInterval);
    };

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      $scope.stopPolling();
    });

    $scope.isAuthenticated = function() {
        return $cookies.get(COOKIE_KEYS.AUTHENTICATED);
    };

    $scope.cancelBuildTeams = function () {
        if($scope.buildTeamsModal){
            $scope.buildTeamsModal.dismiss("User canceled");
        }
    };

});

myAppModule.controller('overviewController', function ($scope, $interval, $rootScope, $uibModal, $http, $sce, ngToast, $location, $routeParams, $timeout, $cookies, CONFIG, COOKIE_KEYS, spinnerService, $translate) {
    'use strict';

    $scope.refreshGames = function() {
        $scope.initGames()
    };

    $scope.initGames = function () {
            $http.get(CONFIG.API_ENDPOINT + '/games/open')
                .then(function(response) {
                    $scope.games = response.data;
                }, function() {
                    $translate('cannotLoadEvents').then(function (text) {
                        $scope.showErrorToast(text);
                        $scope.stopPolling();
                    });
                }
            );
    };

    $scope.interval = $interval($scope.refreshGames, 5000);

    $scope.stopPolling = function() {
        $interval.cancel($scope.interval);
    }

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      $scope.stopPolling();
    });

    $scope.addGame = function() {
	var game = {"name":$scope.game.name}
//        $http.post(CONFIG.API_ENDPOINT + '/games',JSON.stringify(event), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
        $http.post(CONFIG.API_ENDPOINT + '/games', JSON.stringify(game), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
            .success(function(response) {
                var gameId = response.id;
                $translate('eventAdded').then(function (text) {
                    $scope.showInfoToast(text + "!");
                });
                $rootScope.createGameModal.close("Event added");
                $rootScope.$broadcast('game-source-changed');
		$rootScope.createGameModal.close("done");
                $location.path("/games/" + gameId)
            })
            .catch(function(response) {
                $translate('cannotAddEvent').then(function (text) {
                    if( response.data.error.code ){
                        $translate(response.data.error.code).then(function (errorCodeTranslation) {
                            $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                        });
                    } else {
                        $scope.showErrorToast(text + "!");
                    }
                });
            })
            .finally(function () {
            });
    };


    $scope.joinGame = function (game_id) {

        $http.get(CONFIG.API_ENDPOINT + '/games/' + game_id + '/join', {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
            .success(function(response) {
                $translate('eventAdded').then(function (text) {
                    $scope.showInfoToast(text + "!");
                });
                $rootScope.$broadcast('game-source-changed');
                $location.path("/games/" + game_id)
            })
            .catch(function(response) {
                $translate('cannotAddEvent').then(function (text) {
                    if( response.data.error.code ){
                        $translate(response.data.error.code).then(function (errorCodeTranslation) {
                            $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                        });
                    } else {
                        $scope.showErrorToast(text + "!");
                    }
                });
            })
            .finally(function () {
            });

    };

    $scope.weDoNotHaveGames = function() {
        if( $scope.games ){
            return $scope.games.length == 0;
        }
        return false;

    };


    $scope.createGame = function() {
        $rootScope.createGameModal = $uibModal.open({
            templateUrl: "./templates/modal/create-game-modal.html",
            controller: "overviewController"
        });
    };


    $scope.isAuthenticated = function() {
        return $cookies.get(COOKIE_KEYS.AUTHENTICATED);
    };

    $scope.showInfoToast = function(message) {
        ngToast.create(message);
    };

    $scope.showWarningToast = function(message){
        ngToast.warning({
            content: $sce.trustAsHtml('<div class="warning-toast">' + message + '</div>'),
            timeout: 5000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.showErrorToast = function(message){
        ngToast.danger({
            content: $sce.trustAsHtml('<div class="error-toast">' + message + '</div>'),
            timeout: 10000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.$on('event-source-changed', function(){
        $scope.$broadcast('eventSourceChanged',$rootScope.eventSource);
    });

    $scope.$on('invalid-form-event', function(){
        $translate('formErrors').then(function (text) {
            $scope.showWarningToast(text + "!");
        });
    });

    $scope.$on('double-clicked-calendar', function () {
        $scope.showAddReservation();
    });

    $scope.$on('add-reservation-clicked', function () {
        $scope.showAddReservation();
    });

});


myAppModule.controller('userController', function($scope, $rootScope, $http, $sce, ngToast, CONFIG, COOKIE_KEYS, $cookies, $translate) {

    $scope.updateUser = function() {
        var userId = $scope.user.id;
        var newUser = {};

        if($scope.editUserForm.username.$dirty){
            newUser.username = $scope.user.username;
        }
        if($scope.editUserForm.email.$dirty){
            newUser.email = $scope.user.email;
        }
        if($scope.editUserForm.password.$dirty){
            newUser.password = $scope.user.password;
        }
        if($scope.editUserForm.active.$dirty){
            newUser.active = $scope.user.active;
        }
        if($scope.editUserForm.admin.$dirty){
            newUser.admin = $scope.user.admin;
        }

        $http.put(CONFIG.API_ENDPOINT + '/users/' + userId, JSON.stringify(newUser), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
            .then(function() {
                $translate('userUpdated').then(function (text) {
                    $scope.showInfoToast(text + "!");
                });
            }, function(response) {
                $translate('cannotUpdateUser').then(function (text) {
                    if( response.data.error.code ){
                       $translate(response.data.error.code).then(function (errorCodeTranslation) {
                           $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                       });
                    } else {
                        $scope.showErrorToast(text + "!");
                    }
                });
            }
        );
    };

    $scope.deleteUser = function(){
        $http.delete(CONFIG.API_ENDPOINT + '/users/' + $scope.user.id, {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
            .success(function(response) {
                $translate('userRemoved').then(function (text) {
                    $scope.showInfoToast(text + "!");
                });
                location.reload();
            })
            .catch(function(response) {
                $translate('cannotRemoveUser').then(function (text) {
                    if( response.data.error.code ){
                        $translate(response.data.error.code).then(function (errorCodeTranslation) {
                            $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                        });
                    } else {
                        $scope.showErrorToast(text + "!");
                    }
                });
            });
    };

    $scope.showInfoToast = function(message) {
        ngToast.create(message);
    };

    $scope.showErrorToast = function(message){
        ngToast.danger({
            content: $sce.trustAsHtml('<div class="error-toast">' + message + '</div>'),
            timeout: 10000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.showWarningToast = function(message){
        ngToast.warning({
            content: $sce.trustAsHtml('<div class="warning-toast">' + message + '</div>'),
            timeout: 5000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

});


myAppModule.controller('headerController', function($scope, $uibModal, $rootScope, $http, ngToast, $sce, CONFIG, $cookies, COOKIE_KEYS, $location, spinnerService, $translate) {

    $rootScope.$on('logout-event', function(){
        $scope.logout();
    });

    $scope.createGame = function() {
        $rootScope.createGameModal = $uibModal.open({
            templateUrl: "./templates/modal/create-game-modal.html",
            controller: "overviewController"
        });
    };

    $scope.showMyAccount = function () {
        $scope.myUser = {};
        $scope.myUser.username = $rootScope.currentUser.username;
        $scope.myUser.id = $rootScope.currentUser.id;
        $scope.myUser.language = $rootScope.currentUser.language;

        $http.get(CONFIG.API_ENDPOINT + '/users/' + $rootScope.currentUser.id + '/nextReservation')
            .then(function(response) {

                var nextReservationStart = response.data.startTime;
                var nextReservationEnd = response.data.endTime;
                if( ! nextReservationEnd || ! nextReservationStart ){
                    $translate('noReservations').then(function (text) {
                        $scope.nextReservation = text;
                    });
                } else {
                    var format = "DD.MM.YYYY HH:mm";
                    $scope.nextReservation = moment(nextReservationStart).format(format) + " - " + moment(nextReservationEnd).format(format);
                }

                $scope.showMyAccountModal = $uibModal.open({
                    templateUrl: "./templates/modal/my-account-modal.html",
                    scope: $scope
                });

            }, function(response) {
                $scope.showMyAccountModal = $uibModal.open({
                    templateUrl: "./templates/modal/my-account-modal.html",
                    scope: $scope
                });
            }
        );
    };

    $scope.cancelUpdateMyAccount = function () {
        if($scope.showMyAccountModal){
            $scope.showMyAccountModal.dismiss("User canceled");
        }
    };

    $scope.updateMyUser = function () {
        if( $scope.myUser.password || $scope.myUser.oldPassword || $scope.myUser.confirmPassword ) {
            angular.forEach(this.myUserForm.$error.required, function(field) {
                field.$setTouched();
            });

            if (this.myUserForm.$invalid){
                $rootScope.$broadcast("invalid-form-event");
                return;
            }
        }

        var userToUpdate = {};
        userToUpdate.language = $scope.myUser.language;

        if( $scope.myUser.password ) {
            userToUpdate.password = $scope.myUser.password;
            userToUpdate.oldPassword = $scope.myUser.oldPassword;
        }

        spinnerService.show('updateMyUserSpinner');

        $http.put(CONFIG.API_ENDPOINT + '/users/' + $scope.myUser.id, JSON.stringify(userToUpdate), {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}})
            .then(function() {
                $translate.use(userToUpdate.language);
                $rootScope.currentUser.language = userToUpdate.language;
                $translate('userUpdated').then(function (text) {
                        $scope.showInfoToast(text + "!");
                    });
                $scope.showMyAccountModal.close("Successful update");
                spinnerService.hide('updateMyUserSpinner');
                }, function(response) {
                    $translate('cannotUpdateUser').then(function (text) {
                        if( response.data.error.code ){
                            $translate(response.data.error.code).then(function (errorCodeTranslation) {
                                $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                            });
                        } else {
                            $scope.showErrorToast(text + "!");
                        }
                    });
                    spinnerService.hide('updateMyUserSpinner');
                }
            );
    };

    $scope.initUser = function () {
        try {
            var exp = $cookies.getObject(COOKIE_KEYS.EXPIRE_DATE);
        } finally {
            var now = moment();
            if ( ! exp || now.isAfter(exp) ) {
                if( $cookies.getObject(COOKIE_KEYS.AUTHENTICATED)){
                    $scope.logout();
                    $translate('sessionExpired').then(function (text) {
                        $scope.showWarningToast(text + "!");
                    });
                }
            } else {
                $rootScope.currentUser = {
                    username: $cookies.getObject(COOKIE_KEYS.USERNAME),
                    id: $cookies.getObject(COOKIE_KEYS.USERID),
                    isAdmin: $cookies.getObject(COOKIE_KEYS.IS_ADMIN),
                    language: $cookies.getObject(COOKIE_KEYS.LANGUAGE)
                };
            }
            $rootScope.selectedDate = new Date();
        }
    };

    $scope.logout= function() {
        $http.post(CONFIG.API_ENDPOINT + '/logout', {headers: {"X-CSRF-TOKEN": $cookies.get(COOKIE_KEYS.CSRF_TOKEN)}});
        $cookies.remove(COOKIE_KEYS.AUTHENTICATED);
        $cookies.remove(COOKIE_KEYS.USERNAME);
        $cookies.remove(COOKIE_KEYS.USERID);
        $cookies.remove(COOKIE_KEYS.IS_ADMIN);
        $rootScope.currentUser = undefined;
        $location.path("/");
    };

	$scope.showLogin = function() {
		$rootScope.loginModal = $uibModal.open({
            templateUrl: "./templates/modal/login-modal.html",
            controller: "headerController"
		});
	};

	$scope.showRegister = function() {
		$rootScope.registerModal = $uibModal.open({
            templateUrl: "./templates/modal/register-modal.html",
            controller: "headerController"
		});
	};

    $scope.cancelLogin = function() {
        if($rootScope.loginModal){
            $rootScope.loginModal.dismiss("User canceled");
        }
    };

    $scope.cancelRegister = function() {
        if($rootScope.registerModal){
            $rootScope.registerModal.dismiss("User canceled");
        }
    };

    $scope.register = function() {
        angular.forEach($scope.registerForm.$error.required, function(field) {
            field.$setTouched();
        });

        if ($scope.registerForm.$invalid){
            $rootScope.$broadcast("invalid-form-event");
            return;
        }

        var user = {
            username: $scope.user.username,
            password: $scope.user.password,
            email: $scope.user.email,
            language: $scope.user.language
        };

        spinnerService.show('registerSpinner');

        $http.post(CONFIG.API_ENDPOINT + '/users',JSON.stringify(user))
            .success(function() {
                $translate('registrationSuccess').then(function (text) {
                    $scope.showInfoToast(text);
                });
                $rootScope.registerModal.close();
            })
            .catch(function(response) {
                $translate('registrationFailed').then(function (text) {
                    if( response.data.error.code ){
                        $translate(response.data.error.code).then(function (errorCodeTranslation) {
                            $scope.showErrorToast("<strong>" + text + "</strong><br/>" + errorCodeTranslation + "!");
                        });
                    } else {
                        $scope.showErrorToast(text + "!");
                    }
                });
            })
            .finally(function() {
                spinnerService.hide('registerSpinner');
            });
    };

    $scope.authenticate = function() {
        $scope.loginFailed = false;
        angular.forEach($scope.loginForm.$error.required, function(field) {
            field.$setTouched();
        });

        if ($scope.loginForm.$invalid){
            $rootScope.$broadcast("invalid-form-event");
            return;
        }

        $scope.authenticateInBackend();
    };

    $scope.authenticateInBackend = function() {
        var username = $scope.username;
        var password = $scope.password;
        var base64_creds = window.btoa(username + ":" + password);
        var req = {
         method: 'GET',
         url: CONFIG.API_ENDPOINT + '/token',
         headers: {
           'Authorization': 'Basic ' + base64_creds
         }
        };

        spinnerService.show('loginSpinner');

        $http(req)
            .then(function(response) {
                if(response.data && response.data.token) {
                    $scope.loginFailed = false;
                    $scope.setupUser(response.data.token);
                    $rootScope.loginModal.close("Successful login");

                    $translate('loginSuccess').then(function (loginText) {
                        $translate('hello').then(function (text) {
                            $scope.showInfoToast("<strong>" + loginText + "!</strong><br/>" + text + " " + $rootScope.currentUser.username);
                        });
                    });
                }
                spinnerService.hide('loginSpinner');
            }, function(response) {
                if( response && response.data ) {
                    if( response.status === 401 ) {
                        $scope.loginFailed = true;
                    } else {
                        $translate('loginFailed').then(function (text) {
                            $scope.showErrorToast(text + "<br/> " + response.data);
                        });
                    }
                } else {
                    $translate('unknownLoginFailure').then(function (text) {
                        $scope.showErrorToast(text + "<br/>");
                    });
                }
                spinnerService.hide('loginSpinner');
            }
        );
    };

    $scope.setupUser = function(token){
        var token_parts = token.split(".");
        var payload = JSON.parse(window.atob(token_parts[1]));
        $rootScope.currentUser = {
            username: payload.user_claims.username,
            id: payload.user_claims.userId,
            isAdmin: payload.user_claims.admin,
            language: payload.user_claims.language
        };
        $scope.useLanguage(payload.user_claims.language);
        $cookies.putObject(COOKIE_KEYS.USERNAME, payload.user_claims.username);
        $cookies.putObject(COOKIE_KEYS.USERID, payload.user_claims.userId);
        $cookies.putObject(COOKIE_KEYS.AUTHENTICATED,true);
        $cookies.putObject(COOKIE_KEYS.IS_ADMIN, payload.user_claims.admin);
        $cookies.putObject(COOKIE_KEYS.EXPIRE_DATE, moment.unix(payload.exp));
        $cookies.putObject(COOKIE_KEYS.CSRF_TOKEN, payload.csrf);
    };

    $scope.showInfoToast = function(message) {
        ngToast.create(message);
    };

    $scope.showErrorToast = function(message){
        ngToast.danger({
            content: $sce.trustAsHtml('<div class="error-toast">' + message + '</div>'),
            timeout: 10000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.showWarningToast = function(message){
        ngToast.warning({
            content: $sce.trustAsHtml('<div class="warning-toast">' + message + '</div>'),
            timeout: 5000,
            dismissOnClick: false,
            dismissButton: true
        });
    };

    $scope.isAuthenticated = function() {
        return $cookies.get("authenticated");
    };

    $scope.isAdmin = function(){
        return $scope.isAuthenticated() && $cookies.getObject(COOKIE_KEYS.IS_ADMIN);
    };

    $scope.showUsersButton = function(){
        return $scope.isAdmin() && $location.path() !== "/users";
    };

    $scope.showCalendarButton = function(){
        return $scope.isAdmin() && $location.path() === "/users";
    };

    $scope.showAddGameButton = function(){
        return $scope.isAuthenticated() && $scope.isAdmin();
    };

    $scope.useLanguage = function(langKey) {
        $translate.use(langKey);
        $cookies.putObject(COOKIE_KEYS.LANGUAGE, langKey);
    };

    $scope.$on("$routeChangeSuccess", function($currentRoute, $previousRoute) {
        if( $location.path() === '/users'){
            $http.get(CONFIG.API_ENDPOINT + '/users')
                        .then(function(response) {
                            $rootScope.allUsers = response.data;
                        }, function(response) {
                            $location.path("/");
                            $translate('cannotLoadUsers').then(function (cannotLoadUsersText) {
                                if( response.data.error.code ){
                                    $translate(response.data.error.code).then(function (text) {
                                        $scope.showErrorToast("<strong>" + cannotLoadUsersText + "</strong><br/>" + text);
                                    });                                } else if( response.data.msg ){
                                    $translate('loginToSeeUsers').then(function (text) {
                                        $scope.showErrorToast("<strong>" + cannotLoadUsersText + "</strong><br/>" + text);
                                    });
                                } else {
                                    $translate('pleaseTryAgain').then(function (text) {
                                        $scope.showErrorToast("<strong>" + cannotLoadUsersText + "</strong><br/>" + text);
                                    });
                                }
                            });
                        }
            );
        }
    });

});
