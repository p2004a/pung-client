var pungClient = angular.module('pung-client', ['ngRoute', 'ngMaterial', 'ngMessages']);

pungClient.filter('filefrompath', function () {
    return function (input) {
        var path = (input + "").split('/');
        return path[path.length - 1];
    };
});

pungClient.controller('UIController', function ($scope, $route, $routeParams, $location) {
    console.log("UIController");
});

pungClient.controller('LoginController', function ($scope, $routeParams, $mdDialog) {
    console.log("LoginController");

    $scope.keyfile = "key file";

    $scope.selectFile = function () {
        var chooser = document.querySelector("#loginFileChooser");
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

    $scope.showLoginErrors = false;
    $scope.tryLogin = function () {
        if ($scope.loginForm.$valid) {
            try {
                var utils = require('./utils');
                var rsaKey = utils.loadRsaKey($scope.keyfile);

                console.log("login!");
            } catch (e) {
                $scope.keyfile = "key file";
                $mdDialog.show(
                    $mdDialog.alert()
                        .title('Error')
                        .content('Cannot load or parse given keyfile.')
                        .ariaLabel('Keyfile error')
                        .ok('ok')
                );
                $scope.showLoginErrors = false;
            }
        } else {
            $scope.showLoginErrors = true;
        }
    };
});

pungClient.controller('SignUpController', function ($scope, $routeParams) {
    console.log("SignUpController");
});

pungClient.controller('CommunicatorController', function ($scope, $routeParams) {
    console.log("CommunicatorController");
});

pungClient.config(function($routeProvider, $locationProvider) {
    $routeProvider
        .when('/login', {
            templateUrl: 'view/login.html',
            controller: 'LoginController',
        })
        .when('/signup', {
            templateUrl: 'view/signup.html',
            controller: 'SignUpController'
        })
        .when('/communicator', {
            templateUrl: 'view/communicator.html',
            controller: 'CommunicatorController'
        })
        .otherwise({
            redirectTo: '/login'
        });

    $locationProvider.html5Mode(true);
});
