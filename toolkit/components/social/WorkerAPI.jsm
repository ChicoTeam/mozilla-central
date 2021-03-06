/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "getFrameWorkerHandle", "resource://gre/modules/FrameWorker.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "openChatWindow", "resource://gre/modules/MozSocialAPI.jsm");

const EXPORTED_SYMBOLS = ["WorkerAPI"];

function WorkerAPI(provider, port) {
  if (!port)
    throw new Error("Can't initialize WorkerAPI with a null port");

  this._provider = provider;
  this._port = port;
  this._port.onmessage = this._handleMessage.bind(this);

  // Send an "intro" message so the worker knows this is the port
  // used for the api.
  // later we might even include an API version - version 0 for now!
  this._port.postMessage({topic: "social.initialize"});
  
  // backwards compat, remove after Aug 1.
  this._port.postMessage({topic: "social.cookie-changed"});
}

WorkerAPI.prototype = {
  terminate: function terminate() {
    this._port.close();
  },

  _handleMessage: function _handleMessage(event) {
    let {topic, data} = event.data;
    let handler = this.handlers[topic];
    if (!handler) {
      Cu.reportError("WorkerAPI: topic doesn't have a handler: '" + topic + "'");
      return;
    }
    try {
      handler.call(this, data);
    } catch (ex) {
      Cu.reportError("WorkerAPI: failed to handle message '" + topic + "': " + ex);
    }
  },

  handlers: {
    "social.user-profile": function (data) {
      this._provider.updateUserProfile(data);
    },
    "social.ambient-notification": function (data) {
      this._provider.setAmbientNotification(data);
    },
    "social.cookies-get": function(data) {
      let document = getFrameWorkerHandle(this._provider.workerURL, null).document;
      let cookies = document.cookie.split(";");
      let results = [];
      cookies.forEach(function(aCookie) {
        let [name, value] = aCookie.split("=");
        results.push({name: unescape(name.trim()),
                      value: unescape(value.trim())});
      });
      this._port.postMessage({topic: "social.cookies-get-response",
                              data: results});
    },
    'social.request-chat': function(data) {
      let xulWindow = Services.wm.getMostRecentWindow("navigator:browser").getTopWin();
      openChatWindow(xulWindow, this._provider, data, null, "minimized");
    },
    'social.notification-create': function(data) {
      let port = this._port;
      let provider = this._provider;
      let {id, type, icon, body, action, actionArgs} = data;
      let alertsService = Cc["@mozilla.org/alerts-service;1"]
                              .getService(Ci.nsIAlertsService);
      function listener(subject, topic, data) {
        if (topic === "alertclickcallback") {
          // we always post back the click
          port.postMessage({topic: "social.notification-action",
                            data: {id: id,
                                   action: action,
                                   actionArgs: actionArgs}});
          switch (action) {
            case "link":
              // if there is a url, make it open a tab
              if (actionArgs.toURL) {
                try {
                  let pUri = Services.io.newURI(provider.origin, null, null);
                  let nUri = Services.io.newURI(pUri.resolve(actionArgs.toURL),
                                                null, null);
                  // fixup
                  if (nUri.scheme != pUri.scheme)
                    nUri.scheme = pUri.scheme;
                  if (nUri.prePath == provider.origin) {
                    let xulWindow = Services.wm.getMostRecentWindow("navigator:browser");
                    xulWindow.openUILink(nUri.spec);
                  }
                } catch(e) {
                  Cu.reportError("social.notification-create error: "+e);
                }
              }
              break;
            default:
              break;
          }
        }
      }
      alertsService.showAlertNotification(icon,
                                          this._provider.name, // title
                                          body,
                                          !!action, // text clickable if an
                                                    // action was provided.
                                          null,
                                          listener,
                                          type); 
    },
  }
}
