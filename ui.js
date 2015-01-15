var pungClient = angular.module('pung-client', ['ngRoute', 'ngMaterial']);

pungClient.controller('UIController', function ($scope, $route, $routeParams, $location) {
    console.log("UIController");
});

pungClient.controller('LoginController', function ($scope, $routeParams) {
    console.log("LoginController");
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
        });

    $locationProvider.html5Mode(true);
});
