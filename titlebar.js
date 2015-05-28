pungClient.controller('TitlebarController', function ($scope) {
    console.log("TitlebarController");
    var gui = require('nw.gui');
    var win = gui.Window.get();

    $scope.isMaximized = false;

    $scope.minimalize = function () {
        win.minimize();
    };

    win.on('maximize', function () {
        $scope.$apply(function () {
            $scope.isMaximized = true;
        });
    })

    win.on('unmaximize', function () {
        $scope.$apply(function () {
            $scope.isMaximized = false;
        });
    })

    $scope.toggleMaximization = function () {
        if ($scope.isMaximized) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    };

    $scope.exit = function () {
        win.close();
    };
});
