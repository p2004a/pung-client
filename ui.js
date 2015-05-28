var pungClient = angular.module('pung-client', ['ngRoute', 'ngMaterial', 'ngMessages', 'luegg.directives']);

pungClient.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13 && !event.shiftKey
              && !event.altKey && !event.ctrlKey) {
                console.log(event);
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});

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
    $scope.try = function (what) {
        var toPretty = {
            "login": "Login",
            "signup": "SignUp"
        };

        if ($scope.entryForm.$valid) {
            var rsaKey = null;
            try {
                var utils = require('./utils');
                rsaKey = utils.loadRsaKey($scope.keyfile);
            } catch (e) {
                $scope.resetFileChooser();
                $scope.errorDialog('Cannot load or parse given keyfile.');
                $scope.showEntryFormErrors = false;
                return;
            }
            $scope.procedure($scope.username, rsaKey, what, toPretty[what]);
        } else {
            $scope.showEntryFormErrors = true;
        }
    };

    $scope.notLoading = true;
    $scope.procedure = function (username, rsaKey, name, prettyName) {
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

                procs[name](cm, user, rsaKey)
                    .onError(function (error) {
                        console.error(error);
                        $timeout(function () {
                            $scope.errorDialog(prettyName + " procedure failed: " + error);
                            $scope.notLoading = true;
                        });
                    })
                    .onValue(function () {
                        $timeout(function () {
                            globalStore.store({
                                cm: cm,
                                user: user,
                                host: host,
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

pungClient.controller('CommunicatorController', function ($scope, globalStore, $location, $mdSidenav, $timeout, $mdDialog) {
    console.log("CommunicatorController");
    var data = globalStore.load();
    var cm = data.cm;
    var rsaKey = data.rsaKey;
    $scope.user = data.user;
    $scope.host = data.host;

    cm.getErrEndStream()
        .onError(function (err) {
            $timeout(function () {
                $scope.errorDialog("Connection error: " + err);
            });
        })
        .onEnd(function () {
            $timeout(function () {
                $location.path('/entry');
            });
        });

    var procs = require('./procedures');
    var cu = require('./connUtils');
    var utils = require('./utils');

    $scope.activeChat = -1;
    $scope.chats = [];
    $scope.friends = [];
    $scope.friendsKey = {};
    $scope.friendMessagesEncrypted = {};
    $scope.friendsMessages = {};
    $scope.friendRequests = [];

    procs.getMessages(cm)
        .onValue(function (res) {
            cm.sendFAFMessage(cu.Message(res, "ok"));
            $timeout(function () {
                var messageText = new Buffer(res.payload[1], 'base64').toString('utf8');
                var friend = res.payload[0];
                var data = {
                    message: res.payload[1],
                    signature: res.payload[2],
                    key: res.payload[3],
                    iv: res.payload[4]
                };
                if ($scope.friendsMessages[friend] === undefined) {
                    if ($scope.friendMessagesEncrypted[friend] === undefined) {
                        $scope.friendMessagesEncrypted[friend] = [];
                    }
                    $scope.friendMessagesEncrypted[friend].push({
                        author: friend,
                        time: $scope.getTime(),
                        data: data
                    });
                } else {
                    $scope.decryptMessage(friend, $scope.getTime(), data);
                }
            });
        })
        .onError(function (err) {
            console.error("Error get_messages: " + err);
        });

    procs.getFriends(cm)
        .onValue(function (res) {
            $timeout(function () {
                var friendName = res.payload[0];
                var friendRsaKey = utils.parseRsaPublic(res.payload[1]);
                if (friendRsaKey === null) {
                    $scope.errorDialog('cannot parse public key from: ' + friendName);
                    return;
                }
                $scope.friends.push({
                    name: friendName,
                    key: friendRsaKey
                });
                $scope.friendsKey[friendName] = friendRsaKey;
                $scope.friendsMessages[friendName] = [];
                if ($scope.friendMessagesEncrypted[friendName] !== undefined) {
                    $scope.friendMessagesEncrypted[friendName].forEach(function (msg) {
                        $scope.decryptMessage(msg.author, msg.time, msg.data);
                    });
                    $scope.openChat(friendName);
                }
            });
        })
        .onError(function (err) {
            console.error("Error get_friends: " + err);
        });

    procs.getFriendRequests(cm)
        .onValue(function (res) {
            $timeout(function () {
                $scope.friendRequests.push({
                    res: res,
                    fullid: res.payload[0]
                });
            });
        })
        .onError(function (err) {
            console.error("Error get_friend_requests: " + err);
        });

    $scope.errorDialog = function (message) {
        $mdDialog.show(
            $mdDialog.alert()
                .title('Error')
                .content(message)
                .ariaLabel('Error')
                .ok('ok')
        );
    };

    $scope.getTime = function () {
        return (new Date()).getTime();
    };

    $scope.decryptMessage = function (friend, time, data) {
        var messageText = utils.decrypt(rsaKey, $scope.friendsKey[friend], data);
        if (messageText === null) {
            $scope.errorDialog("Couldn't decrypt message from " + friend);
        } else {
            $scope.friendsMessages[friend].push({
                author: friend,
                time: time,
                body: messageText
            });
            $scope.openChat(friend);
        }
    };

    $scope.sendMessage = function () {
        var chat = $scope.chats[$scope.activeChat];
        if (chat.message.trim() !== "") {
            var friendName = chat.title;
            var messageText = chat.message;
            chat.message = "";

            var data = utils.encrypt(rsaKey, $scope.friendsKey[friendName], messageText);

            if (data === null) {
                $scope.errorDialog('Cannot encrypt message :(');
            } else {
                $scope.pushMessage(friendName, {
                    author: 'me',
                    time: $scope.getTime(),
                    body: messageText
                });

                procs.sendMessage(cm, friendName, data)
                    .onError(function (err) {
                        $timeout(function () {
                            $scope.errorDialog('Error while sending message: ' + err);
                        });
                    });
            }
        }
    };

    $scope.friendshipResponse = function (res, yes) {
        var index = -1;
        $scope.friendRequests.forEach(function (req, i) {
            if (res == req.res) {
                index = i;
            }
        });
        if (index !== -1) {
            $scope.friendRequests.splice(index, 1);
        }

        var msg = cu.Message(res, yes ? "accept" : "refuse");
        cm.sendFAFMessage(msg);
    };

    $scope.pushMessage = function (friendName, message) {
        $scope.friendsMessages[friendName].push(message);
    };

    $scope.logout = function () {
        procs.logout(cm);
        cm.close();
    };

    $scope.openChat = function (friendName) {
        var set = false;
        $scope.chats.forEach(function (chat, i) {
            if (chat.title == friendName) {
                set = true;
                $scope.activeChat = i;
            }
        });
        if (!set) {
            $scope.chats.push({
                title: friendName,
                messages: $scope.friendsMessages[friendName],
                message: ""
            });
        }
    };

    $scope.closeChat = function (chat) {
        var index = $scope.chats.indexOf(chat);
        if (index !== -1) {
            $scope.chats.splice(index, 1);
        }
    };

    $scope.addFriend = function () {
        $mdDialog.show({
            controller: 'AddFriend',
            templateUrl: 'view/addFriend.html'
        })
        .then(function(friendName) {
            procs.addFriend(cm, friendName)
                .onError(function (err) {
                    $timeout(function () {
                        $scope.errorDialog('Add friend error: ' + err);
                    });
                });
        });
    };
});

pungClient.controller('AddFriend', function ($scope, $mdDialog) {
    $scope.hide = function() {
        $mdDialog.cancel();
    };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };

    $scope.showFormErrors = false;
    $scope.answer = function() {
        if ($scope.addFriendForm.$valid) {
            $mdDialog.hide($scope.username);
        } else {
            $scope.showFormErrors = true;
        }
    };
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
