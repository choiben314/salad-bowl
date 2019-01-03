function show(element) {
	element.style.display = 'block';
}

function hide(element) {
	element.style.display = 'none';
}

function hideClass(className) {
	var divsToHide = document.getElementsByClassName(className);
    for(var i = 0; i < divsToHide.length; i++){
        divsToHide[i].style.display = 'none';
    }
}

function returnToInit() {
	hideClass('not-init');
	show(initElement);
}

function toggleButton(input, button) {
	if (input.value) {
		button.removeAttribute('disabled');
	} else {
		button.setAttribute('disabled', 'true');
	}
}

function toggleButtonMultiple(classElements, button) {
    for(var i = 0; i < classElements.length; i++){
        if (!classElements[i].value) {
        	button.setAttribute('disabled', 'true');
        	return;
        }
    }
    button.removeAttribute('disabled');
}

function onCreateButtonClick(e) {
	gameID = (Math.random().toString(36)+'00000000000000000').slice(2, 7);
	hide(initElement);
	show(createOptionsElement);
}

function onCreateSubmit(e) {
	if (usernameCreateInputElement.value) {
		firebase.database().ref().child('rooms/' + gameID).once('value', snapshot => {
		   	if (snapshot.exists()) {
		   		console.log('Game already exists!');
		   	} else {
		   		hide(createOptionsElement);
				firebase.database().ref('/rooms/' + gameID).set({
					id: gameID,
					started: false,
					memberCount: 0,
					numWords: 0,
					capacity: 20,
					numTeams: numTeamSelectElement.options[numTeamSelectElement.selectedIndex].value,
					inProgress: false,
					roundsRemaining: 3,
				}).then(func => {
					createValueListeners(gameID);
					joinValueListeners(gameID);
					addMember(usernameCreateInputElement.value);
				});
		   	}
		});
	} else {
		console.log("Must enter username!");
	}
}

function onJoinButtonClick(e) {
	hide(initElement);
	show(joinOptionsElement);
}

function onJoinSubmit(e) {
	gameID = gameIDInputElement.value;
	joinValueListeners(gameID);

	if (gameIDInputElement.value && usernameJoinInputElement.value) {
		firebase.database().ref().child('rooms/' + gameIDInputElement.value).once('value', snapshot => {
		   	if (!snapshot.exists()) {
		   		console.log("There are no games with that access code!");
		   	} else {
		   		firebase.database().ref('/rooms/' + gameIDInputElement.value + '/started').once('value', started => {
					if (started.val()) {
						console.log('Game has already started!')
					} else {
						firebase.database().ref().child('rooms/' + gameIDInputElement.value + '/usernames/' + usernameJoinInputElement.value).once('value', username => {
							if (username.exists()) {
								console.log('Username already taken.');
								returnToInit();
							} else {
								firebase.database().ref().child('rooms/' + gameIDInputElement.value + '/usernames/' + usernameJoinInputElement.value).set(-1);
								hide(joinOptionsElement);
								addMember(usernameJoinInputElement.value);
							}
						});
					}
				});
		   	}
		});
	} else {
		console.log("Must enter username and access code!");
	}
}

function addMember(username) {
	firebase.database().ref('rooms/' + gameID + '/capacity').once('value', capacity => {
		firebase.database().ref('/rooms/' + gameID + '/memberCount').once('value', memberCount => {
			if (memberCount.val() >= capacity.val()) {
				console.log('Game already at capacity.');
			} else {
				myUsername = username;
				updateAllLists(gameID, myUsername);
			}
		});
	});
}

function joinValueListeners(gameID) {

	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_added', snapshot => {
		updateAllLists(gameID, myUsername);
	});
	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_changed', snapshot => {
		updateAllLists(gameID, myUsername);
	});
	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_removed', snapshot => {
		updateAllLists(gameID, myUsername);
	});

	firebase.database().ref('/rooms/' + gameID + '/currTeamIdx').on('value', currTeamIdx => {
		if (myTeam != null) {
			firebase.database().ref('/rooms/' + gameID + '/teams/' + myTeam).once('value', snapshot => {
				if (currTeamIdx.val() == snapshot.child('teamIdx').val()) {
					if (snapshot.child('currIdx').val() == snapshot.child('teamMembers').child(myUsername).child('idx').val()) {
						hide(spectatorElement);
						hide(guesserElement);
						show(clueGiverElement);
						show(passCorrectElement);
						show(startTimerButtonElement);
					} else {
						hide(spectatorElement);
						hide(clueGiverElement);
						show(guesserElement);
					}
				} else {
					hide(clueGiverElement);
					hide(guesserElement);
					show(spectatorElement);
				}
			});
		}
	});

	firebase.database().ref('/rooms/' + gameID + '/numWords').on('value', snapshot => {
		firebase.database().ref('/rooms/' + gameID + '/wordsRemaining').set(snapshot.val());
		firebase.database().ref('/rooms/' + gameID + '/started').once('value', started => {
			if (myUsername != null && started.val()) {			
				firebase.database().ref('/rooms/' + gameID + '/memberCount').once('value', memberCount => {
					if (snapshot.val() == memberCount.val() * 3) {
						startGame();
					}
				});
			}
		});
	});

	firebase.database().ref('/rooms/' + gameID + '/wordsRemaining').on('value', snapshot => {
		if (snapshot.val() == 0) {
			endRound(true);
		}
	});

	firebase.database().ref('/rooms/' + gameID + '/roundsRemaining').on('value', snapshot => {
		if (snapshot.val() == 0) {
			showEndGame();
		}
	});

	firebase.database().ref('/rooms/' + gameID + '/started').on('value', snapshot => {
		if (snapshot.val()) {
			console.log(myUsername);
			firebase.database().ref('/rooms/' + gameID + '/members/' + myUsername).once('value', username => {
				if (username.exists()) {
					hide(waitingElement);
					show(getWordsElement);
				} else {
					returnToInit();
					console.log('Game has already started!');
				}
			});
		}
	});
	
	firebase.database().ref('/rooms/' + gameID + '/inProgress').on('value', snapshot => {
		if (snapshot.val()) {
			console.log('Starting Timer Now');
			startTimer(60);
		} else {
			timerTextElement.innerHTML = "1:00";
		}
	});
}

function createValueListeners(gameID) {
	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_added', snapshot => {
		updateAllLists(gameID, myUsername);
		firebase.database().ref('/rooms/' + gameID + '/memberCount').transaction(current_value => {
			return (current_value || 0) + 1;
		});
	});
	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_changed', snapshot => {
		updateAllLists(gameID, myUsername);
	});
	firebase.database().ref('/rooms/' + gameID + '/members/').on('child_removed', snapshot => {
		updateAllLists(gameID, myUsername);
		firebase.database().ref('/rooms/' + gameID + '/memberCount').transaction(current_value => {
			return (current_value || 0) - 1;
		});
	});
	
	firebase.database().ref('/rooms/' + gameID + '/numTeams').on('value', snapshot => {
		for (var i = 1; i <= snapshot.val(); i++) {
			firebase.database().ref('/rooms/' + gameID + '/teams/' + i).set({teamIdx: i - 1, currIdx: 0, teamPoints: 0, teamCount: 0});
		}
	});
}

function updateAllLists(gameID, username) {
	firebase.database().ref('/rooms/' + gameID + '/teams/').once('value').then(teams => {
		waitingTextElement.innerHTML="Access Code: " + gameID;
		waitingPlayerListElement.innerHTML='';
		teams.forEach(team => {
			var joinTeamButton = document.createElement('button');
			joinTeamButton.classList.add("block");
			var t = document.createTextNode("Join Team " + team.key);
			joinTeamButton.appendChild(t);
			waitingPlayerListElement.appendChild(joinTeamButton);

			function onJoinTeamClickListener() {
				myTeam = team.key;
				firebase.database().ref('/rooms/' + gameID + '/members/' + username).set({
					team: team.key
				});
			}

			joinTeamButton.addEventListener('click', onJoinTeamClickListener);

			firebase.database().ref('/rooms/' + gameID + '/members/').once('value', members => {
				members.forEach(member => {
					if (member.child('team').val() == team.key) {
						var entry = document.createElement('p');
						entry.classList.add("list-child");
						entry.appendChild(document.createTextNode(member.key));
						waitingPlayerListElement.appendChild(entry);
					}
				});
			}); 
		});
		show(waitingElement);
	});
}

function onStartButtonClick() {
	firebase.database().ref('/rooms/' + gameID + '/teams').once('value', snapshot => {
		snapshot.forEach(team => {
			firebase.database().ref('/rooms/' + gameID + '/members').once('value', members => {
				members.forEach(member => {
					if (team.key == member.child('team').val()) {
						firebase.database().ref('/rooms/' + gameID + '/teams/' + team.key + '/teamCount').transaction(current_value => {
							firebase.database().ref('/rooms/' + gameID + '/teams/' + team.key + '/teamMembers/' + member.key).set({idx: current_value});
							return (current_value || 0) + 1;
						});
					}
				});
			});
		});
	}).then(func => {
		firebase.database().ref('/rooms/' + gameID + '/teams').once('value', snapshot => {
			var valid = true;
			snapshot.forEach(team => {
				// CHANGEBACKHERE
				if (team.child('teamCount').val() < 2) {
					valid = false;
				}
			});
			if (valid) {
				firebase.database().ref('/rooms/' + gameID + '/started').set(true);
			} else {
				firebase.database().ref('/rooms/' + gameID + '/numTeams').once('value', snapshot => {
					for (var i = 1; i <= snapshot.val(); i++) {
						firebase.database().ref('/rooms/' + gameID + '/teams/' + i).set({teamIdx: i - 1, currIdx: 0, teamPoints: 0, teamCount: 0});
					}
				});
				console.log("Each team must have at least two members!");
			}
		});
	});
}

function submitWords(w1, w2, w3) {
	firebase.database().ref('/rooms/' + gameID + '/words/').push(w1);
	firebase.database().ref('/rooms/' + gameID + '/words/').push(w2);
	firebase.database().ref('/rooms/' + gameID + '/words/').push(w3);

	var numWords = firebase.database().ref('/rooms/' + gameID + '/numWords');
	numWords.transaction(function(current_value) {
		return (current_value || 0) + 3;
	});
}

function onSubmitWordsButtonClick() {
	hide(getWordsElement);
	submitWords(getWordsInput1Element.value, getWordsInput2Element.value, getWordsInput3Element.value);
	firebase.database().ref('/rooms/' + gameID + '/numWords').once('value', numWords => {
		firebase.database().ref('/rooms/' + gameID + '/memberCount').once('value', memberCount => {
			if (numWords.val() != memberCount.val() * 3) {
				show(waitingWordsElement);
			}
		});
	});
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function resetQueue() {
	console.log('resettingQueue');
	firebase.database().ref('/rooms/' + gameID + '/words').once('value', words => {
		queue = [];
		words.forEach(word => {
			queue.push(word.val());
		});
		queue = shuffle(queue);
		for (var i = 0; i < queue.length; i++) {
			firebase.database().ref('/rooms/' + gameID + '/queue/' + i).set(queue[i]);
		}
		firebase.database().ref('/rooms/' + gameID + '/numWords').once('value', numWords => {
			firebase.database().ref('/rooms/' + gameID + '/wordsRemaining').set(numWords.val());
		});
	});
}

function startGame() {
	resetQueue();
	hide(waitingWordsElement);
	firebase.database().ref('/rooms/' + gameID + '/currTeamIdx').set(0);
	show(timerElement);
}

function showNextWord() {
	firebase.database().ref('/rooms/' + gameID + '/queue').orderByKey().limitToFirst(1).once('value', snapshot => {
		currentWordElement.innerHTML = '';
		snapshot.forEach(data => {
			currentWordElement.innerHTML = data.val();
		});
	});
}

function onStartTimerButtonClick() {
	hide(startTimerButtonElement);
	show(inProgressElement);
	showNextWord();
	firebase.database().ref('/rooms/' + gameID + '/inProgress').set(true);
}

function removeFirst() {
	firebase.database().ref('/rooms/' + gameID + '/queue').orderByKey().limitToFirst(1).once('value', snapshot => {
		snapshot.forEach(data => {
			firebase.database().ref('/rooms/' + gameID + '/queue/' + data.key).remove();
		});
		showNextWord();
	});
}

function onPassButtonClick() {
	firebase.database().ref('/rooms/' + gameID + '/queue').orderByKey().limitToLast(1).once('value', snapshot => {
		var newIdx;
		snapshot.forEach(data => {
			newIdx = parseInt(data.key) + 1;
		});
		firebase.database().ref('/rooms/' + gameID + '/queue').orderByKey().limitToFirst(1).once('value', snapshot => {
			snapshot.forEach(data => {
				firebase.database().ref('/rooms/' + gameID + '/queue/' + newIdx).set(data.val());
			});
			removeFirst();
		});
	});
}

function onCorrectButtonClick() {
	firebase.database().ref('/rooms/' + gameID + '/teams/' + myTeam + '/teamPoints').transaction(current_value => {
		return (current_value || 0) + 1;
	});
	firebase.database().ref('/rooms/' + gameID + '/queue').once('value', snapshot => {
		removeFirst();
	});
	firebase.database().ref('/rooms/' + gameID + '/wordsRemaining').transaction(current_value => {
		return (current_value || 0) - 1;
	});
}

function endRound(queueEmpty) {
	clearInterval(time);
	currentWordElement.innerHTML='';
	hide(passCorrectElement);
	firebase.database().ref('/rooms/' + gameID + '/inProgress').once('value', inProgress => {
		if (inProgress.val()) {
			firebase.database().ref('/rooms/' + gameID + '/currTeamIdx').once('value', currTeamIdx => {
				firebase.database().ref('/rooms/' + gameID + '/teams/' + myTeam).once('value', snapshot => {
					firebase.database().ref('/rooms/' + gameID + '/roundsRemaining').once('value', roundsRemaining => {
						if (roundsRemaining.val() != 0) {
							// only run once (requests sent by clue giver only)
							if (currTeamIdx.val() == snapshot.child('teamIdx').val()) {
								if (snapshot.child('currIdx').val() == snapshot.child('teamMembers').child(myUsername).child('idx').val()) {
									firebase.database().ref('/rooms/' + gameID + '/inProgress').set(false);
			            			hide(inProgressElement);
			            			if (queueEmpty) {
										firebase.database().ref('/rooms/' + gameID + '/roundsRemaining').transaction(roundsRemaining_value => {
											return roundsRemaining_value - 1;
										});
										if (roundsRemaining.val() != 1) {
											resetQueue();
										}
										console.log("Starting Next Round!");
			            			} else {
			            				onPassButtonClick();
			            			}
			            			// queue is not empty or queue is empty and not last round
			            			if (!queueEmpty || (queueEmpty && roundsRemaining.val() != 1)) {
				            			firebase.database().ref('/rooms/' + gameID + '/numTeams').once('value', numTeams => {
				            				firebase.database().ref('/rooms/' + gameID + '/currTeamIdx').transaction(current_value => {
				            					return ((current_value || 0) + 1) % numTeams.val();
				            				});
				            			});
				            			firebase.database().ref('/rooms/' + gameID + '/teams/' + myTeam + '/teamCount').once('value', teamCount => {
				            				firebase.database().ref('/rooms/' + gameID + '/teams/' + myTeam + '/currIdx').transaction(current_value => {
				            					return ((current_value || 0) + 1) % teamCount.val();
				            				});
				            			});
			            			}
								}
							}
						}
					});
				});
	        });
		}
	});
}

// duration is in seconds
function startTimer(duration) {
	var start = Date.now(), diff, minutes, seconds;
	function timer() {
		diff = duration - (((Date.now() - start) / 1000) | 0);
		minutes = (diff / 60) | 0;
		seconds = (diff % 60) | 0;
		// minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

		timerTextElement.innerHTML = minutes + ":" + seconds;

        if (diff <= 0) {
	        minutes = (duration / 60) | 0;
			seconds = (duration % 60) | 0;
			// minutes = minutes < 10 ? "0" + minutes : minutes;
	        seconds = seconds < 10 ? "0" + seconds : seconds;
			timerTextElement.innerHTML = minutes + ":" + seconds;
			endRound(false);
           	return;
        }
    }
    // we don't want to wait a full second before the timer starts
    timer();
    time = setInterval(timer, 1000);
}

function showEndGame() {
	hideClass('not-init');
	show(endGameElement);
	firebase.database().ref('/rooms/' + gameID + '/teams').once('value', snapshot => {
		snapshot.forEach(team => {
			var entry = document.createElement('p');
			entry.classList.add("list-child");
			entry.appendChild(document.createTextNode("Team " + team.key + " - Score: " + team.child('teamPoints').val()));
			teamPointsListElement.appendChild(entry);
		});
	}).then(func => {
		gameID = null;
		myUsername = null;
		myTeam = null;
		time = null;
	});
}

var gameID;
var myUsername = null;
var myTeam;
var time;

// Shortcuts to DOM Elements

// Initial Screen
var initElement = document.getElementById('init-game');
var createButtonElement = document.getElementById('create');
var joinButtonElement = document.getElementById('join');

// Create New Game
var createOptionsElement = document.getElementById('create-options');
var usernameCreateInputElement = document.getElementById('username-create');
var numTeamSelectElement = document.getElementById('num-team-select');
var submitCreateButtonElement = document.getElementById('submit-create');
var createBackButtonElement = document.getElementById('create-back');

// Join By ID
var joinOptionsElement = document.getElementById('join-options');
var gameIDInputElement = document.getElementById('game-id');
var usernameJoinInputElement = document.getElementById('username-join');
var submitJoinButtonElement = document.getElementById('submit-join');
var joinBackButtonElement = document.getElementById('join-back');

// Waiting Screen
var waitingElement = document.getElementById('waiting');
var waitingTextElement = document.getElementById('waiting-game-id');
var waitingPlayerListElement = document.getElementById('waiting-player-list');
var startButtonElement = document.getElementById('start');

// Submit Words Screen
var getWordsElement = document.getElementById('get-words');
var getWordsFormElement = document.getElementById('get-words-form');
var getWordsInput1Element = document.getElementById('word-1');
var getWordsInput2Element = document.getElementById('word-2');
var getWordsInput3Element = document.getElementById('word-3');
var submitWordsButtonElement = document.getElementById('submit-words');
var getWordsClass = document.getElementsByClassName('get-words-class');

// Waiting for Submissions Screen
var waitingWordsElement = document.getElementById('waiting-words');

// Game Screens
var spectatorElement = document.getElementById('spectator');
var guesserElement = document.getElementById('guesser');

var clueGiverElement = document.getElementById('clue-giver');
var startTimerButtonElement = document.getElementById('start-timer');
var timerElement = document.getElementById('timer');
var timerTextElement = document.getElementById('timer-text');
var inProgressElement = document.getElementById('in-progress');
var currentWordElement = document.getElementById('current-word');
var passButtonElement = document.getElementById('pass');
var correctButtonElement = document.getElementById('correct');
var passCorrectElement = document.getElementById('pass-correct');

// End Game
var endGameElement = document.getElementById('end-game');
var teamPointsListElement = document.getElementById('team-points-list');
var backToHomeButtonElement = document.getElementById('back-to-home');

// Form & Button Listeners
createButtonElement.addEventListener('click', onCreateButtonClick);
joinButtonElement.addEventListener('click', onJoinButtonClick);
submitCreateButtonElement.addEventListener('click', onCreateSubmit);
submitJoinButtonElement.addEventListener('click', onJoinSubmit);
createBackButtonElement.addEventListener('click', returnToInit);
joinBackButtonElement.addEventListener('click', returnToInit);

startButtonElement.addEventListener('click', onStartButtonClick);
submitWordsButtonElement.addEventListener('click', onSubmitWordsButtonClick);
startTimerButtonElement.addEventListener('click', onStartTimerButtonClick);
passButtonElement.addEventListener('click', onPassButtonClick);
correctButtonElement.addEventListener('click', onCorrectButtonClick);
backToHomeButtonElement.addEventListener('click', returnToInit);

getWordsInput1Element.addEventListener('keyup', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});
getWordsInput2Element.addEventListener('keyup', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});
getWordsInput3Element.addEventListener('keyup', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});

getWordsInput1Element.addEventListener('change', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});
getWordsInput2Element.addEventListener('change', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});
getWordsInput3Element.addEventListener('change', function(e) {
	toggleButtonMultiple(getWordsClass, submitWordsButtonElement);
});
