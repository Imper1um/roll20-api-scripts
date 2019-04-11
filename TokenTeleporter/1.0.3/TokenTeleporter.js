var TokenTeleporter = TokenTeleporter || (function(){
	'use strict';
/*******
 * AutoTeleporting Tokens v1.0.3
 * The purpose of this is to allow tokens to automatically teleport between locations on the map.
 *
 * Each token that you can teleport to needs to be setup on the GM Layer.
 * NOTE: Tokens that are *not* on the GM Layer cannot be used as teleporters. However,
 *    all tokens, on any layer can use the teleporter.
 * WARNING: This system *will* delete any non-JSON GM Notes on any token you set as an auto-teleporter, or
 *    a destination teleporter. If you intend to have GM Notes on the token, please use them as JSON extra
 *    options. For example: {"GMNotes":"This is my Notes",TokenTeleporter:{"auto":"enabled","destination":"stairsA1"}}
 * LIMITATION: Teleporters *currently* do not work between maps (believe me, I'm looking into it). The main limitation
 *    is that the API does not allow for the switching between maps. It must be done manually by the GM.
 *    I'm currently looking into copying tokens between maps, but, for now, this limitation is required.
 *
 * DEFAULT OPTIONS
 * Changing values here will change the default values when it comes down to loading this script. */
	var blockAll = false;			//If true, all options, except --allowall will be disabled.
	var blockPlayerNamed = true;	//If true, players may not use the --to command.
	var blockPlayerAuto = false;	//If true, player controlled tokens cannot use auto teleporters.
	var blockGmAuto = false;		//If true, gm controlled tokens cannot use auto teleporters.
	var outputDebug = false;		//If true, Debug output will be pushed to the log.
	var outputVerbose = false;		//If true, Verbose output will be pushed to the log.
/**
 * !!!!!!!!!!!!!!!!!!! All commands begin with !Teleport. !!!!!!!!!!!!!!!!!!!!!!!
 * 
 * When you select a token, you have the following options:
 *
 * TOKEN SPECIFIC OPTIONS (GM ONLY):
 * --auto <enable/disable>
 *   Enables Automatic Teleporting for this specific token. When disabled, all tokens cannot use this teleporter.
 *
 * --name <Name>
 *   Sets the name of the teleporter. This is the same as changing the name of the token.
 *
 * --destination <Name>
 *   Sets the destination of the teleporter.
 *
 * --namedteleporting <enable/disable>
 *   Allows the teleporter to be teleported to by name. 
		By default, this is disabled.

 * --autoteleporting <enable/disable>
 *   Allows the teleporter to be used automatically. 
		By default, this is enabled.
*
 * --autoallow <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
 *   Allows objects on specific layers or control state to be automatically moved using the teleporter.
 *   	By default, teleporters can move objects on gmlayer and objectlayer. Also, both gmcontrolled and playercontrolled objects can be moved.
 *
 * --autoblock <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
 *   Blocks objects on specific layers or control state to be automatically moved using the teleporter.
 *    
 * --namedallow <gmlayer objectlayer maplayer dynamiclighting player>
 *   Allows for named calling of this teleporter. By default, objects on the gmlayer and object layer can be moved, and player execution is enabled.
 *
 * --namedblock <gmlayer objectlayer maplayer dynamiclighting player>
 *   Blocks objects on specific layers or control state to be moved using the --to command.
 *
 * TOKEN SPECIFIC OPTIONS (Everyone, if enabled):
 * --to <Name>
 *   Teleports the selected tokens to the specific named teleporter. The named teleporter must be on the same map *and*
 *
 * GLOBAL OPTIONS (GM ONLY):
 * --blockall
 *   Disables all functionality of the TokenTeleporter, except --allowall and --help.
 *
 * --allowall
 *   Enables all functionality of the TokenTeleporter.
 *
 * --blockplayernamed
 *   Disables players from using the --to command.
 *
 * --allowplayernamed
 *   Allows players to use the --to command.
 *
 * --blockplayerauto
 *   Disables player controlled tokens from using automatic teleporters globally.
 * 
 * --allowplayerauto
 *   Enables player controlled tokens to use automatic teleports globally.
 *
 * --toggledebug
 *   Toggles debug output to the log.
 *
 * --toggleverbose
 *   Toggles verbose output to the log.
 *
 * --status
 *   Lets the user know of all of the global state status.
 *
 * GLOBAL OPTIONS:
 * --help
 *   Shows the help screen.
 */
	var version = "1.0.3";
	var module = "TokenTeleporter";
	
	//Helper Functions
	var currentDateOutput = function() {
        var date = new Date();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        if (month < 10) { month = "0" + month; }
        if (day < 10) { day = "0" + day; }
        if (hours < 10) { hours = "0" + hours; }
        if (minutes < 10) { minutes = "0" + minutes; }
        if (seconds < 10) { seconds = "0" + seconds; }
        return date.getFullYear() + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    };
	
	var getWhisperTarget = function(options) {
		var nameProperty, targets, type;

		options = options || {};

		if (options.player) {
			nameProperty = 'displayname';
			type = 'player';
		} else if (options.character) {
			nameProperty = 'name';
			type = 'character';
		} else {
			return '';
		}

		if (options.id) {
			targets = [getObj(type, options.id)];

			if (targets[0]) {
				return '/w ' + targets[0].get(nameProperty).split(' ')[0] + ' ';
			}
		}
		if (options.name) {
			targets = _.sortBy(filterObjs(function(obj) {
				if (obj.get('type') !== type) {
					return false;
				}
				return obj.get(nameProperty).indexOf(options.name) >= 0;
			}), function(obj) {
				return Math.abs(levenshteinDistance(obj.get(nameProperty), options.name));
			});

			if (targets[0]) {
				return '/w ' + targets[0].get(nameProperty).split(' ')[0] + ' ';
			}
		}

		return '';
	};
	
	var whisperTalker = function(msg, contents) {
        logVerboseOutput('whisperTalker');
        sendChat(module, getWhisperTarget({"player":true, "id":msg.playerid}) + contents);
    };
    
    var logDebugOutput = function(item) {
        if (!outputDebug) { return; }
        log('['+module+':DEBUG:' + currentDateOutput() + '] ' + item);
    };
	
	var logVerboseOutput = function(item) {
        if (!outputVerbose) { return; }
        log('['+module+':VERBOSE:' + currentDateOutput() + '] ' + item);
    };
    
    var logOutput = function(item) {
        log('['+module+':' + currentDateOutput() + '] ' + item);
    };
	
	var setGmNotes = function(token, gmNotesObject) {
        token.set({"gmnotes": JSON.stringify(gmNotesObject)});
    };
    
    var getGmNotes = function(token) {
        var gmNotes = token.get("gmnotes") || "{}";
        try {
            gmNotes = decodeURIComponent(gmNotes);
        } catch (ex) {
            //Ignore. This may fail when the token is empty.
        }
        if (gmNotes && gmNotes.length) {
            gmNotes = gmNotes.trim();
        }
		try {
			return JSON.parse(gmNotes);
		} catch (ex) {
			//Parsing failed. This is usually because this is empty *or* the GM
			//put GM Notes in this object that violated the JSON Constraints.
			return {};
		}
    };
	
	var handleMessageInlineRolls = function(msg) {
		logDebugOutput("handleMessageInlineRolls");
		if (_.has(msg,'inlinerolls')) {
          msg.content = _.chain(msg.inlinerolls)
            .reduce(function(m,v,k){
                var ti=_.reduce(v.results.rolls,function(m2,v2){
                    if(_.has(v2,'table')){
                        m2.push(_.reduce(v2.results,function(m3,v3){
                            m3.push(v3.tableItem.name);
                            return m3;
                        },[]).join(', '));
                    }
                    return m2;
                },[]).join(', ');
                m['$[['+k+']]']= (ti.length && ti) || v.results.total || 0;
                return m;
            },{})
            .reduce(function(m,v,k){
                return m.replace(k,v);
            },msg.content)
            .value();
        }
		return msg;
	};
	
	//On Commands
	var onChatMessage = function(msg) {
		logVerboseOutput("onChatMessage");
		if (msg.type !== "api") { return; }
		msg.isGM = playerIsGM(msg.playerid);
		if ((blockPlayerNamed || blockAll) && !msg.isGM) { return; }
		msg = handleMessageInlineRolls(msg);
		logDebugOutput("Message from '" +msg.who + "' Content: " + msg.content);
		
		var args = msg.content
            .replace(/<br\/>\n/g, ' ')
            .replace(/(\{\{(.*?)\}\})/g," $2 ")
            .split(/\s+--/);
		var initialCommand = args.shift();
		logVerboseOutput("initialCommand: '" + initialCommand + "'");
		if (initialCommand != "!Teleport") { return; }
		
		var name = null;
		var destination = null;
		var namedTeleporting = null;
		var autoTeleporting = null;
		var targetTo = null;
		var autoAllow = null;
		var autoBlock = null;
		var namedAllow = null;
		var namedBlock = null;
		
		var setBlockAll = null;
		var setBlockPlayerNamed = null;
		var setBlockPlayerAuto = null;
		var setBlockGmAuto = null;
		var activateToggleDebug = false;
		var activateToggleVerbose = false;
		logVerboseOutput("Processing args...");
		while (args.length) {
			var commands = args.shift().match(/([^\s]+[|#]'[^']+'|[^\s]+[|#]"[^"]+"|[^\s]+)/g);
			
			switch (commands.shift()) {
				case 'help':
				    logVerboseOutput("arg: help");
					onHelp(msg);
					return;
				case 'status':
				    logVerboseOutput("arg: status");
					if (msg.isGM) { onStatus(msg); return; }
					onHelp(msg); 
					return;
				case 'toggledebug':
				    logVerboseOutput("arg: toggledebug");
					activateToggleDebug = true;
					break;
				case 'toggleverbose':
				    logVerboseOutput("arg: toggleverbose");
					activateToggleVerbose = true;
					break;
				case 'name':
				    logVerboseOutput("arg: name");
					name = "";
					while (commands.length) {
						name += commands.shift() + " ";
					}
					name = name.trim();
					break;
				case 'destination':
				    logVerboseOutput("arg: destination");
					destination = "";
					while (commands.length) {
						destination += commands.shift() + " ";
					}
					destination = destination.trim();
					logVerboseOutput(" == " + destination)
					break;
				case 'namedteleporting':
				    logVerboseOutput("arg: namedteleporting");
					if (commands.shift() == "enable") {
						namedTeleporting = true;
					} else {
						namedTeleporting = false;
					}
					break;
				case 'autoteleporting':
				    logVerboseOutput("arg: autoteleporting");
					if (commands.shift() == "enable") {
						autoTeleporting = true;
					} else {
						autoTeleporting = false;
					}
					break;
				case 'autoallow':
				    logVerboseOutput("arg: autoallow");
					autoAllow = [];
					while (commands.length) {
						autoAllow.push(commands.shift());
					}
					break;
				case 'autoblock':
				    logVerboseOutput("arg: autoblock");
					autoBlock = [];
					while (commands.length) {
						autoBlock.push(commands.shift());
					}
					break;
				case 'namedallow':
				    logVerboseOutput("arg: namedallow");
					namedAllow = [];
					while (commands.length) {
						namedAllow.push(commands.shift());
					}
					break;
				case 'namedblock':
				    logVerboseOutput("arg: namedblock");
					namedBlock = [];
					while (commands.length) {
						namedBlock.push(commands.shift());
					}
					break;
				case 'to':
				    logVerboseOutput("arg: to");
					targetTo = "";
					while (commands.length) {
						targetTo += commands.shift() + " ";
					}
					targetTo = targetTo.trim();
					break;
				case 'blockall':
				    logVerboseOutput("arg: blockall");
					setBlockAll = true;
					break;
				case 'allowall':
				    logVerboseOutput("arg: allowall");
					setBlockAll = false;
					break;
				case 'blockplayernamed':
				    logVerboseOutput("arg: blockplayernamed");
					setBlockPlayerNamed = true;
					break;
				case 'allowplayernamed':
				    logVerboseOutput("arg: allowplayernamed");
					setBlockPlayerNamed = false;
					break;
				case 'blockplayerauto':
				    logVerboseOutput("arg: blockplayerauto");
					setBlockPlayerAuto = true;
					break;
				case 'allowplayerauto':
				    logVerboseOutput("arg: allowplayerauto");
					setBlockPlayerAuto = false;
					break;
				case 'blockgmauto':
				    logVerboseOutput("arg: blockgmauto");
					setBlockGmAuto = true;
					break;
				case 'allowgmauto':
				    logVerboseOutput("arg: allowgmauto");
					setBlockGmAuto = false;
					break;
				case 'toggledebug':
				    logVerboseOutput("arg: toggledebug");
					activateToggleDebug = true;
					break;
				case 'toggleverbose':
				    logVerboseOutput("arg: toggleverbose");
					activateToggleVerbose = true;
					break;
			}
		}
		
		//Start with the Global Commands.
		if (msg.isGM) {
		    logVerboseOutput("isGM");
			if (setBlockAll != null) {
				logVerboseOutput("setBlockAll: " + setBlockAll);
				blockAll = setBlockAll;
				if (blockAll) {
					whisperTalker(msg, "All blocking enabled.");
					return;
				} else {
					whisperTalker(msg, "All blocking disabled.");
				}
			}
			if (setBlockPlayerNamed != null) {
				logVerboseOutput("setBlockPlayerNamed: " + setBlockPlayerNamed);
				blockPlayerNamed = setBlockPlayerNamed;
				if (blockPlayerNamed) {
					whisperTalker(msg, "Player named teleporting disabled.");
					return;
				} else {
					whisperTalker(msg, "Player named teleporting enabled.");
				}
			}
			if (setBlockPlayerAuto != null) {
				logVerboseOutput("setBlockPlayerAuto: " + setBlockPlayerAuto);
				blockPlayerAuto = setBlockPlayerAuto;
				if (blockPlayerAuto) {
					whisperTalker(msg, "Player auto teleporting disabled.");
					return;
				} else {
					whisperTalker(msg, "Player auto teleporting enabled.");
				}
			}
			if (setBlockGmAuto != null) {
				logVerboseOutput("setBlockGmAuto: " + setBlockGmAuto);
				blockGmAuto = setBlockGmAuto;
				if (blockGmAuto) {
					whisperTalker(msg, "GM auto teleporting disabled.");
					return;
				} else {
					whisperTalker(msg, "GM auto teleporting enabled.");
				}
			}
			if (activateToggleDebug) {
				toggleDebug();
				if (outputDebug) {
					whisperTalker(msg, "Debug output enabled.");
				} else {
					whisperTalker(msg, "Debug output disabled.");
				}
			}
			if (activateToggleVerbose) {
				toggleVerbose();
				if (outputVerbose) {
					whisperTalker(msg, "Verbose output enabled.");
				} else {
					whisperTalker(msg, "Verbose output disabled.");
				}
			}
		}
		
		var allIssues = [];
		var infoUpdate = [];
		
		//Individual Token Commands.
		_.chain(msg.selected)
         .uniq()
         .map(function(o) { return getObj('graphic', o._id); })
         .reject(_.isUndefined)
         .each(function(token) {
			 var tokenName = token.get("name");
			 var tokenLeft = token.get("left");
			 var tokenTop = token.get("top");
			 logVerboseOutput("processing " + tokenName);
			//--to
			if (targetTo != null) {
				logVerboseOutput("targetTo:" + targetTo);
				var target = findObjs({
					_pageid: token.get("_pageid"),
					_type: "graphic",
					layer: "gmlayer",
					name: targetTo
				});
				if (target.length == 0) {
					logDebugOutput("No tokens found on page that matched that name.");
					allIssues.push("Destination not found.");
					var targetTo = null; //null it out to prevent other tokens from causing the same issue.
					return;
				}
				
				var destinationToken = null;
				_.each(target, function(d) {
					if (isValidNamedDestination(token, d)) { destinationToken = d; }
				});
				if (destinationToken == null) {
					logDebugOutput("All valid destination tokens did not have properties that allowed the teleporting of this token.");
					allIssues.push(tokenName + ": All valid destinations could not accept this token.");
					return;
				}
				var destinationLeft = destinationToken.get("left");
				var destinationTop = destinationToken.get("top");
				token.set({ "left": destinationLeft, "top": destinationTop });
				logVerboseOutput("Moved " + tokenName + " from " + tokenLeft +"," + tokenTop + " to " + destinationToken.get("name") + " located at " + destinationLeft + "," + destinationTop + " (real new loc:" + token.get("left") + "," + token.get("top") + ")");
			}
			
			//GM Commands (everything else)
			if (!msg.isGM) { return; }
			logVerboseOutput("destination == " + destination);
			if (destination == null && namedTeleporting == null && autoTeleporting == null && autoAllow == null && autoBlock == null && namedAllow == null && namedBlock == null) {
				//Nothing to do? Just stop with this token!
				return;
			}
			
			logVerboseOutput("Processing GM Token commands...");
			
			//--name
			if (name != null) {
				token.set({"name": name});
				infoUpdate.push(tokenName + ": Changed name to '" + name + "'");
			}
			var tokenGmNotes = getGmNotes(token);
			if (!tokenGmNotes.TokenTeleporter) {
				//This is defaults. I wouldn't change them, but if you feel like
				// you really want to change defaults, have at it.
				tokenGmNotes.TokenTeleporter = {
					"NamedTeleporting": false,
					"AutoTeleporting": true,
					"Destination": null,
					"NamedAllow": ["gmlayer","objects","player"],
					"AutoAllow": ["gmlayer","objects","player","gm"]
				};
			}
			//--destination
			if (destination != null) {
			    logVerboseOutput("destination != null");
				tokenGmNotes.TokenTeleporter.Destination = destination;
				infoUpdate.push(tokenName + ": Changed destination to '" + destination + "'");
			}
			//--namedteleporting <enable/disable>
			if (namedTeleporting != null) {
				if (tokenGmNotes.TokenTeleporter.NamedTeleporting != namedTeleporting) {
					tokenGmNotes.TokenTeleporter.NamedTeleporting = namedTeleporting;
					if (namedTeleporting) {
						infoUpdate.push(tokenName + ": Enabled named teleporting.");
					} else {
						infoUpdate.push(tokenName + ": Disabled named teleporting.");
					}
				}
			}
			//--autoteleporting <enable/disable>
			if (autoTeleporting != null) {
				if (tokenGmNotes.TokenTeleporter.AutoTeleporting != autoTeleporting) {
					tokenGmNotes.TokenTeleporter.AutoTeleporting = autoTeleporting;
					if (autoTeleporting) {
						infoUpdate.push(tokenName + ": Enabled auto teleporting.");
					} else {
						infoUpdate.push(tokenName + ": Disabled auto teleporting.");
					}
				}
			}
			//--autoallow <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
			if (autoAllow != null) {
				_.each(autoAllow, function(a) {
					switch (a) {
						case 'gmlayer':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("gmlayer")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("gmlayer");
								infoUpdate.push(tokenName + ": Enabled Auto GM Layer teleporting.");
							}
							break;
						case 'objectlayer':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("objects")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("objects");
								infoUpdate.push(tokenName + ": Enabled Auto Object Layer teleporting.");
							}
							break;
						case 'maplayer':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("map")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("map");
								infoUpdate.push(tokenName + ": Enabled Auto Map Layer teleporting.");
							}
							break;
						case 'dynamiclighting':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("walls")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("walls");
								infoUpdate.push(tokenName + ": Enabled Auto Dynamic Lighting Layer teleporting.");
							}
							break;
						case 'gmcontrolled':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("gm")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("gm");
								infoUpdate.push(tokenName + ": Enabled Auto GM Controlled Token teleporting.");
							}
							break;
						case 'playercontrolled':
							if (!tokenGmNotes.TokenTeleporter.AutoAllow.includes("player")) {
								tokenGmNotes.TokenTeleporter.AutoAllow.push("player");
								infoUpdate.push(tokenName + ": Enabled Auto Player Controlled Token teleporting.");
							}
							break;
					}
				});
			}
			//--autoblock <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
			if (autoBlock != null) {
				_.each(autoBlock, function(a) {
					switch (a) {
						case 'gmlayer':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("gmlayer")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "gmlayer");
								infoUpdate.push(tokenName + ": Disabled Auto GM Layer teleporting.");
							}
							break;
						case 'objectlayer':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("objects")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "objects");
								infoUpdate.push(tokenName + ": Disabled Auto Object Layer teleporting.");
							}
							break;
						case 'maplayer':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("map")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "map");
								infoUpdate.push(tokenName + ": Disabled Auto Map Layer teleporting.");
							}
							break;
						case 'dynamiclighting':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("walls")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "walls");
								infoUpdate.push(tokenName + ": Disabled Auto Dynamic Lighting Layer teleporting.");
							}
							break;
						case 'gmcontrolled':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("gm")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "gm");
								infoUpdate.push(tokenName + ": Disabled Auto GM Controlled Token teleporting.");
							}
							break;
						case 'playercontrolled':
							if (tokenGmNotes.TokenTeleporter.AutoAllow.includes("player")) {
								tokenGmNotes.TokenTeleporter.AutoAllow = dropItem(tokenGmNotes.TokenTeleporter.AutoAllow, "player");
								infoUpdate.push(tokenName + ": Disabled Auto Player Controlled Token teleporting.");
							}
							break;
					}
				});
			}
			
			//--namedallow <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
			if (namedAllow != null) {
				_.each(namedAllow, function(a) {
					switch (a) {
						case 'gmlayer':
							if (!tokenGmNotes.TokenTeleporter.NamedAllow.includes("gmlayer")) {
								tokenGmNotes.TokenTeleporter.NamedAllow.push("gmlayer");
								infoUpdate.push(tokenName + ": Enabled Named GM Layer teleporting.");
							}
							break;
						case 'objectlayer':
							if (!tokenGmNotes.TokenTeleporter.NamedAllow.includes("objects")) {
								tokenGmNotes.TokenTeleporter.NamedAllow.push("objects");
								infoUpdate.push(tokenName + ": Enabled Named Object Layer teleporting.");
							}
							break;
						case 'maplayer':
							if (!tokenGmNotes.TokenTeleporter.NamedAllow.includes("map")) {
								tokenGmNotes.TokenTeleporter.NamedAllow.push("map");
								infoUpdate.push(tokenName + ": Enabled Named Map Layer teleporting.");
							}
							break;
						case 'dynamiclighting':
							if (!tokenGmNotes.TokenTeleporter.NamedAllow.includes("walls")) {
								tokenGmNotes.TokenTeleporter.NamedAllow.push("walls");
								infoUpdate.push(tokenName + ": Enabled Named Dynamic Lighting Layer teleporting.");
							}
							break;
						case 'player':
							if (!tokenGmNotes.TokenTeleporter.NamedAllow.includes("player")) {
								tokenGmNotes.TokenTeleporter.NamedAllow.push("player");
								infoUpdate.push(tokenName + ": Enabled Named Player Controlled Token teleporting.");
							}
							break;
					}
				});
			}
			//--namedblock <gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled>
			if (namedBlock != null) {
				_.each(namedBlock, function(a) {
					switch (a) {
						case 'gmlayer':
							if (tokenGmNotes.TokenTeleporter.NamedAllow.includes("gmlayer")) {
								tokenGmNotes.TokenTeleporter.NamedAllow = dropItem(tokenGmNotes.TokenTeleporter.NamedAllow, "gmlayer");
								infoUpdate.push(tokenName + ": Disabled Named GM Layer teleporting.");
							}
							break;
						case 'objectlayer':
							if (tokenGmNotes.TokenTeleporter.NamedAllow.includes("objects")) {
								tokenGmNotes.TokenTeleporter.NamedAllow = dropItem(tokenGmNotes.TokenTeleporter.NamedAllow, "objects");
								infoUpdate.push(tokenName + ": Disabled Named Object Layer teleporting.");
							}
							break;
						case 'maplayer':
							if (tokenGmNotes.TokenTeleporter.NamedAllow.includes("map")) {
								tokenGmNotes.TokenTeleporter.NamedAllow = dropItem(tokenGmNotes.TokenTeleporter.NamedAllow, "map");
								infoUpdate.push(tokenName + ": Disabled Named Map Layer teleporting.");
							}
							break;
						case 'dynamiclighting':
							if (tokenGmNotes.TokenTeleporter.NamedAllow.includes("walls")) {
								tokenGmNotes.TokenTeleporter.NamedAllow = dropItem(tokenGmNotes.TokenTeleporter.NamedAllow, "walls");
								infoUpdate.push(tokenName + ": Disabled Named Dynamic Lighting Layer teleporting.");
							}
							break;
						case 'player':
							if (tokenGmNotes.TokenTeleporter.NamedAllow.includes("player")) {
								tokenGmNotes.TokenTeleporter.NamedAllow = dropItem(tokenGmNotes.TokenTeleporter.NamedAllow, "player");
								infoUpdate.push(tokenName + ": Disabled Named Player Controlled Token teleporting.");
							}
							break;
					}
				});
			}
			
			logVerboseOutput("Token GM Notes set to " + JSON.stringify(tokenGmNotes));
			setGmNotes(token, tokenGmNotes);
		 });
		 
		 logVerboseOutput("Done. AllIssues = " + allIssues.length + ", InfoUpdate = " + infoUpdate.length);
		
		if (allIssues.length) {
			var issuesPush = '<div style="border: solid #000 1px; background-color: #FCC;"><strong>Teleporter had the following errors:</strong><ul>';
			_.each(allIssues, function(issue) {
				issuesPush += "<li>" + issue + "</li>";
			});
			issuesPush += "</ul></div>";
			logVerboseOutput("allIssues = " + issuesPush);
			whisperTalker(msg, issuesPush);
		}
		if (infoUpdate.length) {
			var infoPush = '<div style="border: solid #000 1px; background-color: #CCF; padding: 4px;"><strong>Teleporter Results:</strong><ul>';
			_.each(infoUpdate, function(issue) {
				infoPush += "<li>" + issue + "</li>";
			});
			infoPush += "</ul></div>";
			logVerboseOutput("infoUpdate = " + infoPush);
			whisperTalker(msg, infoPush);
		}
	};
	
	var dropItem = function(arr) {
		logVerboseOutput("dropItem");
		var what, a = arguments, L = a.length, ax;
		while (L > 1 && arr.length) {
			what = a[--L];
			while ((ax= arr.indexOf(what)) !== -1) {
				arr.splice(ax, 1);
			}
		}
		return arr;
	};
	
	var isGmToken = function(token) {
		logVerboseOutput("isGmToken");
		var isGmToken = true;
		_.each(token.get("controlledby").split(","), function (playerid) {
		   if (playerid == "all") {
			   isGmToken = false;
		   } else if (!playerIsGM(playerid)) {
			   isGmToken = false;
		   }
		});
		return isGmToken;
	};
	
	var isValidNamedDestination = function(token, destination) {
		logVerboseOutput("isValidNamedDestination");
		var options = getGmNotes(destination);
		if (!options.TokenTeleporter) { return false; }
		if (!options.TokenTeleporter.NamedTeleporting) { return false; }
		if (!options.TokenTeleporter.Destination) { return false; }
		
		var tokenIsGm = isGmToken(token);
		var tokenLayer = token.get("layer");
		if (!options.TokenTeleporter.NamedAllow.includes(tokenLayer)) { return false; }
		if (!tokenIsGm && !options.TokenTeleporter.NamedAllow.includes("player")) { return false; }
		return true;
	};
	
	var isValidAutoTeleportPad = function(token, destination) {
		logVerboseOutput("isValidAutoTeleportPad");
		var options = getGmNotes(destination);
		if (!options.TokenTeleporter) { return false; }
		if (!options.TokenTeleporter.AutoTeleporting) { return false; }
		if (!options.TokenTeleporter.Destination) { return false; }
		
		var tokenIsGm = isGmToken(token);
		var tokenLayer = token.get("layer");
		if (!options.TokenTeleporter.AutoAllow.includes(tokenLayer)) { return false; }
		if (!tokenIsGm && !options.TokenTeleporter.AutoAllow.includes("player")) { return false; }
		if (tokenIsGm && !options.TokenTeleporter.AutoAllow.includes("gm")) { return false; }
		return true;
	};
	
	
	var onChangeGraphic = function(obj) {
		logVerboseOutput("onChangeGraphic");
		if (blockAll) { return; }
		var tokenGmNotes = getGmNotes(obj);
		if (tokenGmNotes.TokenTeleporter && (tokenGmNotes.TokenTeleporter.AutoTeleporting || tokenGmNotes.TokenTeleporter.NamedTeleporting)) {
			logVerboseOutput("Graphic moved is teleporter. Ignoring.");
			//Don't teleport teleporters.
			return;
		}
		
		var tokenCurrentLeft = obj.get("left");
		var tokenCurrentTop = obj.get("top");
		var tokenPageId = obj.get("_pageid");
		var tokenGm = isGmToken(obj);
		if (tokenGm && blockGmAuto) {
			logVerboseOutput("Graphic moved is GM and GM teleporting is off.");
			return;
		}
		if (!tokenGm && blockPlayerAuto) {
			logVerboseOutput("Graphic moved is Player and Player teleporting is off.");
			return;
		}
		
		var tokensHereOnGmLayer = findObjs({
			_pageid: tokenPageId,
			_type: "graphic",
			layer: "gmlayer", //MUST be gmlayer
			left: tokenCurrentLeft,
			top: tokenCurrentTop
		});
		if (!tokensHereOnGmLayer || !tokensHereOnGmLayer.length) {
			logVerboseOutput("Graphic moved had no Teleport tokens underneath.");
			return;
		}
		var teleportPad = null;
		_.each(tokensHereOnGmLayer, function(pad) {
			if (isValidAutoTeleportPad(obj, pad)) {
				teleportPad = pad;
			}
		});
		if (teleportPad == null) {
			logVerboseOutput("Graphic moved onto teleport pad, but it did not qualify for teleporting.");
			return;
		}
		var teleportPadOptions = getGmNotes(teleportPad).TokenTeleporter;
		if (!teleportPadOptions.Destination) {
			logVerboseOutput("Graphic moved onto a valid teleport pad, but it had no destination mentioned!");
			return;
		}
		var possibleDestinations = findObjs({
			_pageid: tokenPageId,
			_type: "graphic",
			layer: "gmlayer",
			name: teleportPadOptions.Destination
		});
		if (!possibleDestinations || !possibleDestinations.length) {
			logVerboseOutput("Graphic moved onto a valid teleport pad, but the destination it mentioned did not exist.");
			return;
		}
		//Randomly select a destination from the chart.
		var destinationNumber = Math.floor(Math.random() * possibleDestinations.length);
		var destination = possibleDestinations[destinationNumber];
		var newLeft = destination.get("left");
		var newTop = destination.get("top");
		obj.set({"left":newLeft, "top":newTop});
		logVerboseOutput("Moved " + obj.get("name") + " from " + tokenCurrentLeft +"," + tokenCurrentTop + " to " + destination.get("name") + " located at " + newLeft + "," + newTop + " (real new loc:" + obj.get("left") + "," + obj.get("top") + ")");
	};
	
	var onStatus = function(msg) {
		logVerboseOutput("onStatus");
		var message = "Teleporter System Status -- RUNNING<ul>";
		var enabled = '<li style="color: #060;">';
		var blocked = '<li style="color: #600;">';
		if (blockAll) {
			message += blocked + "BlockAll enabled. Use --allowall to unblock.";
		} else {
			message += enabled + "BlockAll Disabled.</li>";
			message += statusMessage(blockPlayerNamed, "Player --to");
			message += statusMessage(blockPlayerAuto, "Player Auto Teleporting");
			message += statusMessage(blockGmAuto, "GM Auto Teleporting");
			message += statusMessage(!outputDebug, "Debug output");
			message += statusMessage(!outputVerbose, "Verbose output");
		}
		message += "</ul>";
		whisperTalker(msg, message);
	};
	
	var onHelp = function(msg) {
		logVerboseOutput("onHelp");
		
		var hangingLi = '<li style="padding-left: 1.5em; text-indent:-1.5em; margin-bottom: 14px;">';
		var ul = '<ul style="list-style-type: none;">';
		var returnMessage = '<div style="border: solid 1px #000; background-color: #FFF; padding: 3px; width: 100%">'
            + '<div style="padding: 5px; background-color: #FFC; font-weight: bold; text-align: center; margin: 5px; width: 100%; font-size: 14px;">'+module+' v' + version + '<br />by Zachare Sylvestre</div>' +
            + 'This API addon allows for a token to serve as a teleporter, or for tokens to be teleported to a specific location via command.<br />'
			+ '<br />'
			+ '<span style="color: #F00;">NOTE:</span> All commands begin with !Teleport</span><br />';
		if (msg.isGM && !blockAll) {
			returnMessage += '<span style="color: #F70">WARNING:</span> Teleport Pads can only be placed on the GM layer, and using these commands will replace the GM Notes on the token if there are non-JSON Properties on the token.';
			returnMessage += "<h5>Token Specific Options (GM Only)</h5>"
				+ ul
				+ hangingLi + '<strong>--auto [enable/disable]</strong><br />Enables automatic teleporting for this specific token. When disabled, all tokens cannot use this teleport pad.</li>'
				+ hangingLi + '<strong>--name [Name]</strong><br />Sets the teleport pad name to [Name]. This is the same as changing the name of the token.</li>'
				+ hangingLi + '<strong>--destination [Name]</strong><br />Sets the destination of the teleport pad name to [Name].</li>'
				+ hangingLi + '<strong>--namedteleporting [enable/disable]</strong><br />Allows the teleporter to be teleported to by name. By default, this is enabled.</li>'
				+ hangingLi + '<strong>--autoallow [gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled]</strong><br />Allows objects on specific layers or control state to be automatically moved using the teleporter.</br><i>By default,</i> teleporters can move objects on gmlayer and objectlayer. Also, both gmcontrolled, and playercontrolled tokens can be moved.</li>'
				+ hangingLi + '<strong>--autoblock [gmlayer objectlayer maplayer dynamiclighting gmcontrolled playercontrolled]</strong><br />Blocks objects on specific layers or control state from being moved automatically.</li>'
				+ hangingLi + '<strong>--namedallow [gmlayer objectlayer maplayer dynamiclighting player]</strong><br />Allows for named calling of this teleporter.<br /><i>By default,</i> objects on the gmlayer and objectlayer can be moved, and player execution is enabled.</li>'
				+ hangingLi + '<strong>--namedblock [gmlayer objectlayer maplayer dynamiclighting player]</strong><br />Blocks objects on specific layers or control states from using the --to command for this object.'
				+ '</ul>';
			returnMessage += '<h5>Global Options (GM Only)</h5>' + ul;
			returnMessage += hangingLi + '<strong>--blockall</strong><br />Disables all functionality of the TokenTeleporter, except --allowall and --help.</li>';
			if (blockPlayerNamed) {
				returnMessage += hangingLi + '<strong>--allowplayernamed</strong><br />Enables players to use the --to command.</li>';
			} else {
				returnMessage += hangingLi + '<strong>--blockplayernamed</strong><br />Disables players from using the --to command.</li>';
			}
			if (blockPlayerAuto) {
				returnMessage += hangingLi + '<strong>--allowplayerauto</strong><br />Enables player-controlled tokens to use automatic teleporters.</li>';
			} else {
				returnMessage += hangingLi + '<strong>--blockplayerauto</strong><br />Disables player-controlled tokens from using automatic teleporters.</li>';
			}
			if (blockGmAuto) {
				returnMessage += hangingLi + '<strong>--allowgmauto</strong><br />Enables GM-controlled tokens to use automatic teleporters.</li>';
			} else {
				returnMessage += hangingLi + '<strong>--blockplayerauto</strong><br />Disables GM-controlled tokens from using automatic teleporters.</li>';
			}
			returnMessage += hangingLi + '<strong>--toggledebug</strong><br />Toggles debug output to the log.</li>';
			returnMessage += hangingLi + '<strong>--toggleverbose</strong><br />Toggles verbose output to the log.</li>';
			returnMessage += hangingLi + '<strong>--status</strong><br />Shows the system status to the user.</li>';
			returnMessage += "</ul>";
		}
		else if (msg.isGM && blockAll) {
			returnMessage += "<h5>Global Options (GM Only)</h5>"
				+ ul
				+ hangingLi + '<strong>--allowall</strong><br/>Enables all functionality of the TokenTeleporter.</li>'
				+ "</ul>";
		}
		else if (!msg.isGM && (blockAll || blockPlayerNamed)) {
			returnMessage += "All commands are currently off for non-GMs.";
		}
		if (!blockAll && (!blockPlayerNamed || msg.isGM)) {
			returnMessage += "<h5>Token Specific Options (All Users)</h5>"
				+ ul
				+ hangingLi + '<strong>--to [Name]</strong><br />Teleports the selected token to the [Name] token, if it is enabled.</li>'
				+ '</ul>';
		}
		returnMessage += "</div>";
		whisperTalker(msg, returnMessage);
	};
	
	//Activator Functions
	var registerEventHandlers = function() {
		on('chat:message', onChatMessage);
		on('change:graphic', onChangeGraphic);
		logOutput("Event Handlers Registered.");
	};
	
	//Public Functions 
	var setGlobalBlocking = function(val) {
		blockAll = val;
	};
	
	var toggleDebug = function() {
		outputDebug = !outputDebug;
		if (outputDebug) {
			logOutput("Debug output enabled.");
		} else {
			logOutput("Debug output disabled.");
		}
	};
	
	var toggleVerbose = function() {
		outputVerbose = !outputVerbose;
		if (outputVerbose) {
			logOutput("Verbose output enabled.");
		} else {
			logOutput("Verbose output disabled.");
		}
	};
	
	var isDebugOn = function() {
		return outputDebug;
	};
	
	var isVerboseOn = function() {
		return outputVerbose;
	};
	
	var onReady = function() {
		logOutput('v' + version + ' starting up...');
		registerEventHandlers();
		logOutput('Successfully loaded.');
	};
	
	return {
		SetGlobalBlocking: setGlobalBlocking,
		OnReady: onReady,
		IsDebugOn: isDebugOn,
		IsVerboseOn: isVerboseOn,
		ToggleDebug: toggleDebug,
		ToggleVerbose: toggleVerbose
	}
})();

on("ready", function() {
    'use strict';
    TokenTeleporter.OnReady();
});