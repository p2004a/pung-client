var pungClient = angular.module('pung-client', ['ngRoute', 'ngMaterial', 'ngMessages']);

pungClient.filter('filefrompath', function () {
    return function (input) {
        var path = (input + "").split('/');
        return path[path.length - 1];
    };
});

pungClient.factory('globalStore', function() {
    var val = null;
    return {
        store: function (newVal) {
            val = newVal;
        },
        load: function () {
            return val;
        }
    };
});

pungClient.controller('UIController', function ($scope) {
    console.log("UIController");
});

pungClient.controller('EntryController', function ($scope, globalStore, $mdDialog, $location, $timeout) {
    console.log("EntryController");
    $scope.keyfile = "key file";

    $scope.selectFile = function () {
        var chooser = document.querySelector("#entryFormFileChooser");
        var listener = function (evt) {
            var path = this.value;
            $scope.$apply(function () {
                $scope.keyfile = path || "key file";
            });
            chooser.removeEventListener("change", listener);
        };

        chooser.addEventListener("change", listener);

        chooser.click();
    };

    $scope.resetFileChooser = function () {
        $scope.keyfile = "key file";
        document.querySelector("#entryFormFileChooser").value = null;
    };

    $scope.errorDialog = function (message) {
        $mdDialog.show(
            $mdDialog.alert()
                .title('Error')
                .content(message)
                .ariaLabel('Error')
                .ok('ok')
        );
    };

    $scope.showEntryFormErrors = false;
    $scope.tryLogin = function () {
        if ($scope.entryForm.$valid) {
            var rsaKey = null;
            try {
                var utils = require('./utils');
                rsaKey = utils.loadRsaKey($scope.keyfile);
            } catch (e) {
                $scope.resetFileChooser();
                $scope.errorDialog('Cannot load or parse given keyfile.');
                $scope.showEntryFormErrors = false;
            }
            $scope.loginProcedure($scope.username, rsaKey);
        } else {
            $scope.showEntryFormErrors = true;
        }
    };

    $scope.notLoading = true;
    $scope.loginProcedure = function (username, rsaKey) {
        $scope.notLoading = false;

        var Kefir = require("kefir").Kefir;
        var procs = require('./procedures');
        var tlsStream = require("./tlsStream");
        var cu = require('./connUtils');

        var usernameList = username.split('@');
        var user = usernameList[0];
        var host = usernameList[1];

        tlsStream.create(host, 24948, 2000)
            .onValue(function (stream) {
                var cm = cu.ConnectionManager(stream);

                procs.login(cm, user, rsaKey)
                    .onError(function (error) {
                        console.error(error);
                        $timeout(function () {
                            $scope.errorDialog("Login procedure failed: " + error);
                            $scope.notLoading = true;
                        });
                    })
                    .onValue(function () {
                        $timeout(function () {
                            globalStore.store({
                                cm: cm,
                                username: user,
                                rsaKey: rsaKey
                            });
                            $location.path('/communicator');
                        });
                    });
            })
            .onError(function (error) {
                console.error(error);
                $timeout(function () {
                    $scope.errorDialog("Cannot establish secure connection with server");
                    $scope.notLoading = true;
                });
            });
    };
});

pungClient.controller('CommunicatorController', function ($scope, globalStore, $location) {
    console.log("CommunicatorController");
    angular.extend($scope, globalStore.load());
});

pungClient.config(function($routeProvider, $locationProvider) {
    $routeProvider
        .when('/entry', {
            templateUrl: 'view/entry.html',
            controller: 'EntryController',
        })
        .when('/communicator', {
            templateUrl: 'view/communicator.html',
            controller: 'CommunicatorController'
        })
        .otherwise({
            redirectTo: '/entry'
        });

    $locationProvider.html5Mode(true);
});
