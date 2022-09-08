// try {
//   importScripts("background.js");
// } catch (e) {
//   console.error(e);
// }
const app = chrome.runtime.getManifest();
//wait for the prefs initialization
const onWrapper = callback => (...args) => prefsInited.then(() => callback.apply(callback, args));
const setAlarm = (()=>
{
  //using alarms as a backup plan in case extension was suspended
  const list = new Map();
  const listener = alarm =>
  {
    // if (list.get(alarm.name).timer)
    //   console.log("alarm", alarm.name, new Date().toISOString(), new Date(alarm.scheduledTime).toISOString(), alarm);

    ret.exec(alarm.name);
  };
  const ret = (func, time, name) =>
  {
    if (name === undefined)
      name = func.toString();

    const when = new Date().getTime() + time;
    // console.log("alarm set", name, new Date().toISOString(), new Date(when).toISOString());
    const alarm = list.get(name);
    if (alarm)
      clearTimeout(alarm.timer);

    chrome.alarms.clear(name);
    chrome.alarms.create(name, {when});
    list.set(name, {func, timer: setTimeout(() => listener({name, scheduledTime: when}), time)});
  };
  Object.assign(ret, {
    delete: name =>
    {
      if (name instanceof Function) 
        name = name.toString();

      chrome.alarms.clear(name);
      list.delete(name);
    },
    exec: name =>
    {
      const alarm = list.get(name);
      console.log("alarm.exec", name, alarm);
      if (!alarm || !alarm.timer || !(alarm.func instanceof Function))
        return;

      clearTimeout(alarm.timer);
      alarm.timer = null;
      alarm.func();
    }
  });
  chrome.alarms.onAlarm.addListener(listener);
  return ret;
})();


importScripts("include/utils.js");
importScripts("include/messenger.js");
importScripts("include/common.js");
importScripts("include/debug.js");
importScripts("include/tabsManager.js");
const TABS = new TabsManager();
importScripts("include/prefs.js");
// importScripts("include/icon.js");
// const ICON = new Icon("ui/icons/action_24.png");

//broadcast message to reconnect to the service worker
chrome.runtime.sendMessage(null, "reconnect").catch(()=>{});

const contextMenu = {
  onClick: {},
  list: new Map(),
  add: function(menuItem, force)
  {
    if (this.list[menuItem.id])
    {
      if (!force)
        return menuItem;

      this.remove(menuItem.id);
    }
    if (!menuItem.contexts.length)
      return menuItem;

    let _menu = Object.assign({}, menuItem);
    if (menuItem.onclick)
      this.onClick[menuItem.id] = menuItem.onclick;

    delete _menu.onclick;
    chrome.contextMenus.remove(menuItem.id, () => chrome.runtime.lastError);
    const id = chrome.contextMenus.create(_menu, () =>
    {
      if (chrome.runtime.lastError)
      debug.log("contextMenu.add error:", chrome.runtime.lastError.message, menuItem);
    // else
      // debug.log("contextMenu.add:", menuItem);

    });
    this.list.set(id, menuItem);
    return id;
  },
  remove: function(id)
  {
    const menuItem = this.list.get(id);
    if (menuItem)
    {
      chrome.contextMenus.remove(id, () =>
      {
        if (chrome.runtime.lastError)
          debug.log("contextMenu.remove error:", chrome.runtime.lastError.message, menuItem);
        else
          debug.log("contextMenu.remove:", menuItem);
      });
    }
    this.list.delete(id);
  },
  update: function(menuItem)
  {
    const _menuItem = this.list.get(menuItem.id);
    if (!_menuItem)
      return;

    for (let i in _menuItem)
    {
      if (menuItem[i] !== undefined)
        _menuItem[i] = menuItem[i];
    }
    let _menu = Object.assign({}, menuItem);
    if (_menuItem.onclick)
      this.onClick[menuItem.id] = _menuItem.onclick;

    delete _menu.onclick;
    delete _menu.id;
    chrome.contextMenus.update(menuItem.id, _menu);
  }
};

const onChange = {
  iconActionChanged: (id, newVal, oldVal) =>
  {
    debug.log("iconActionChanged", {id, newVal, oldVal});
    chrome.tabs.query({})
    .then(tabs =>
    {
      for (var i = 0; i < tabs.length; i++)
        setIcon(tabs[i]);
    });
  },

  createContextMenu: (id, newVal, oldVal, data) =>
  {
    debug.log("createContextMenu", {id, newVal, oldVal, data});
    let menus;
    if (data === undefined)
      menus = ["lastUsed", "skip", "unload", "unloadWindow", "unloadAll", /*"freeze", "protect",*/ "separator", "options", "separator", "list", "listAction"];
    else
      menus = Object.keys(data);

    const contexts = ["action", "page", "frame"],
          menuList = {
            lastUsed: {
              title: chrome.i18n.getMessage("contextMenu_lastUsed"),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                const lastTab = TABS.last(tab.windowId, true, [tab.id]);
                if (!lastTab)
                  return; 
                // noChange = TABS.noChange;
                // TABS.noChange = true;
                // const callback = (...args) => {
                //   setTimeout(() => TABS.noChange = noChange);
                //   TABS.removeListener("activated", callback);
                //   debug.log("noChange", TABS.noChange, args);
                // };
                // TABS.addListener("activated", callback);
                TABS.activate(lastTab.id);

              }
            },
            undo: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_UNDO),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_UNDO);
              }
            },
            skip: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_1"),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_SKIP);
              }
            },
            // freeze: {
            //   title: chrome.i18n.getMessage("iconAction_" + ACTION_FREEZE),
            //   contexts: contexts,
            //   onclick: (info, tab) =>
            //   {
            //     actionButton(tab, ACTION_FREEZE);
            //   }
            // },
            // protect: {
            //   title: chrome.i18n.getMessage("iconAction_" + ACTION_PROTECT),
            //   contexts: contexts,
            //   onclick: (info, tab) =>
            //   {
            //     actionButton(tab, ACTION_PROTECT);
            //   }
            // },
            list: {
              title: "----- [ " + chrome.i18n.getMessage("contextMenu_closedTabs") + " ] -----",
              contexts: ["page", "frame"],
              enabled: false,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_LIST);
              }
            },
            separator: {
              type: "separator",
              contexts: contexts,
            },
            listAction: {
              title: chrome.i18n.getMessage("contextMenu_closedTabs"),
              contexts: ["action"],
              type: "menu"
            },
            options: {
              title: chrome.i18n.getMessage("options"),
              contexts: ["page", "frame"],
              onclick: (info, tab) =>
              {
                chrome.runtime.openOptionsPage();
              }
            },
            unload: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_TAB),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_UNLOAD_TAB);
              }
            },
            unloadWindow: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_WINDOW),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_UNLOAD_WINDOW);
              }
            },
            unloadAll: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_UNLOAD_ALL),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_UNLOAD_ALL);
              }
            },

          };
    if (data !== undefined)
    {
      for(let i in data)
      {
        menuList[i] = Object.assign(menuList[i], data[i]);
      }
    }
    for (let m = 0; m < menus.length; m++)
    {
      const itemId = menus[m],
            menuItem = menuList[itemId],
            isUpdate = data && data[itemId],
            force = isUpdate && data[itemId].force;

      if (menuItem === undefined)
        continue;

      menuItem.id = itemId;
      if (menuItem.type == "separator")
        menuItem.id += m;

      if (!prefs.contextMenu)
      {
        for(let i = 0; i < menuItem.contexts.length; i++)
        {
          if (menuItem.contexts[i] == "page" || menuItem.contexts[i] == "frame")
            menuItem.contexts.splice(i--, 1);
        }
      }
debug.log(itemId, menuItem);

      const isList = itemId.substring(0, 4) == "list",
            menuId = menuItem.type == "menu" && itemId;

      if (menuId)
        delete menuItem.type;

      if (isUpdate)
      {
        contextMenu.update(menuItem);
        continue;
      }
      else
        contextMenu.remove(menuItem.id);

      if (isList)
      {
        chrome.sessions.getRecentlyClosed(sessions => // jshint ignore:line
        {
debug.log("getRecentlyClosed", itemId, menuItem.id, menuItem, sessions);
          if (sessions.length && menuItem.contexts.length)
          {
            contextMenu.add(menuItem, force);
          }
          let i = 0,
              max = 10;
          do
          {
            if (!sessions[i] || (itemId === "list" && !prefs.contextMenu))
              break;
            
            const tabs = sessions[i].tab && [sessions[i].tab] || sessions[i].window.tabs;
            for(let n = 0; i++ < 10 && n < tabs.length; n++)
            {
              const tab = tabs[n];
              const details = {
                title: truncate(tab.title),
                id: itemId + i,
                contexts: ["page", "frame"],
                onclick: e => // jshint ignore:line
                {
                  chrome.sessions.restore(tab.sessionId);
                }
              };
              if (menuId)
              {
                details.parentId = menuId;
                details.contexts = menuItem.contexts;
              }

              contextMenu.add(details, true);
            }
          }
          while(i < max);
          for (; i <= max; i++)
          {
            contextMenu.remove(itemId+i);
              // chrome.contextMenus.remove(type+i);
          }
        });
        continue;
      }

      contextMenu.add(menuItem, force);
    }
    const list = [...contextMenu.list.entries()].reduce((ret, a) =>
    {
      for(let i = 0; i < a[1].contexts.length; i++)
      {
        if (!ret[a[1].contexts[i]])
          ret[a[1].contexts[i]] = [];

        ret[a[1].contexts[i]].push(a);
      }
      return ret;
    }, {});
    for(let i in list)
    {
      list[i] = list[i].filter((a, i, ar) => a[1].type != "separator" || (i && ar[i-1][1].type != a[1].type));
    }
  } //createContextMenu()
}; //onChange

const messagesHandler = {
  _tabs: new Map(),
  _ports: new Map(),
  
  onMessage: (message, sender, _sendResponse) =>
  {
    const isPort = _sendResponse === undefined;
    debug.log("messageHandler", message, sender, _sendResponse);
    let port = sender;
    if (isPort)
    {
      _sendResponse = port.postMessage.bind(port);
      sender = sender.sender;
    }
    debug.log("messageHandler2", message, port, sender, _sendResponse);
    if (sender.id !== chrome.runtime.id)
      return;
  
    const sendResponse = (...args) => (debug.log("messageHandler sendResponse", sender.url, args), _sendResponse.apply(_sendResponse, args));
    switch (message.type)
    {
      case "tab":
        if (isPort)
        {
          messagesHandler._ports.set(port, message.data);
          messagesHandler._tabs.set(message.data.id, message.data);
          setIcon(message.data);
        }

        break;

      case "prefs":
        prefsInited.then(() => sendResponse({type: "prefs", data: prefs.data}));
        break;
  
      case "pref":
        sendResponse(prefs(message.name, message.value));
  
        if (message.name == "syncSettings")
        {
          STORAGE = chrome.storage[message.value ? "sync" : "local"];
          const o = {};
          o[message.name] = message.value;
          prefsSave(o, ()=>{});
        }
        break;
  
    }
    return true;
  }, //onMessage();
  
  onConnect: port =>
  {
    messagesHandler._ports.set(port, null);
    debug.log("onConnect", port);
  },
  
  onDisconnect: port =>
  {
    const tab = messagesHandler._ports.get(port);
    messagesHandler._ports.delete(port);
    messagesHandler._tabs.delete(tab.id);
    setIcon(tab);
  }
  
};// messengerHandler

// messaging
chrome.runtime.onMessage.addListener(messagesHandler.onMessage);
for(let i in messagesHandler)
  messenger[i] && messenger[i](messagesHandler[i]);

const tabsHandler = {
  onActivated: activeInfo =>
  {
    const noChange = TABS.noChange;
    debug.log("onActivated", activeInfo, noChange, TABS.noChange);
    setAlarm(() =>
    {
      debug.log("onActivated onAlarm", activeInfo, noChange, TABS.noChange);
      if (noChange)
        return noChange();

      TABS.notifyListeners("activated", activeInfo);
      tabsGet(activeInfo.tabId, tab =>
      {
        tab = TABS.add(tab);
        debug.log("activated", activeInfo.tabId, TABS.win(), tab);
        setContext(tab);
      });
    }, noChange ? 200 : 300, "onActivated");
  }, //onActivated()

  onCreated: async tab =>
  {
    debug.log("onCreated", tab);
  //  TABS.add({id: tabId, windowId: attachInfo.newWindowId});
    if (tab.pendingUrl && tab.pendingUrl === tab.url) //tab restored?
      return;
  
    let prevTab = TABS.last(tab.windowId);
    TABS.add(tab);
    if (!prevTab)
      prevTab = tab;

    if (prevTab.id != tab.id)
    {

      let index = tab.index;

      const first = chrome.tabs.query({pinned: true, currentWindow: true}),
            last = chrome.tabs.query({currentWindow: true});

      prevTab = await chrome.tabs.get(prevTab.id);
      switch(prefs.newTabPosition)
      {
        case 1: //first
          index = (await first).length;
          break;
        case 2: //next left
          index = Math.max((await first).length, prevTab.index);
          break;
        case 3: //next right
          index = Math.min(prevTab.index + 1, (await last).length - 1);
          break;
        case 4: //last
          index = (await last).length - 1;
          break;
      }
      debug.log("onCreated position", {prefNewTabPosition: prefs.newTabPosition, tabIndex: tab.index, prevTabIndex: prevTab.index,index, first: (await first).length, last: (await last).length-1, prevTabId: prevTab.id, tabId: tab.id, prevTab, tab});
  
  // without setTimeout it scrolls page down when link opens a new tab (and AutoControl installed https://chrome.google.com/webstore/detail/autocontrol-custom-shortc/lkaihdpfpifdlgoapbfocpmekbokmcfd )
  // is it fixed now?
    // setTimeout(() => {
      await new Promise(async resolve =>
      {
        if (!prefs.newTabPosition || tab.index == index)
          return resolve();

        chrome.tabs.move(tab.id, {index})
          .then(res =>
          {
            resolve(true);
          })
          .catch(er => (resolve(), debug.error("onCreated.move", er)));
      });

      const wait = new Promise(resolve => TABS.noChange = resolve);
      debug.log("noChange", "true", {noChange: TABS.noChange, prevTabId: prevTab.id, tabId: tab.id, prevTab, tab});
      TABS.activate(prevTab.id);
      if (prevTab.active)
        TABS.noChange();

      await wait;
      TABS.noChange = false;
    }
    // }, 35);
  
    // fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276
    setAlarm(e =>
    {
      debug.log("noChange", "false", TABS.noChange);
    
      if (prefs.newTabActivate == 1 || tab.url.match(/^chrome/i))
        TABS.activate(tab.id); // foreground
      else if (prefs.newTabActivate == 2 && !tab.url.match(/^chrome/i))
        TABS.activate(prevTab.id); // background
    
      setIcon(tab);
      TABS.updateAll(tab.windowId);
    }, 250, "onCreated");
      
  debug.log("created", TABS.win(tab.windowId), prevTab, tab);
  }, //onCreated()

  onRemoved: (tabId, removeInfo) =>
  {
    debug.log("onRemoved", {tabId, removeInfo});
    debug.log("onRemoved then", {tabId, removeInfo});
    tabsQuery({active: true, windowId: removeInfo.windowId}, tabs =>
    {
      const removedTab = TABS.remove({id: tabId, windowId: removeInfo.windowId}),
            currentTab = tabs[0],
            last = TABS.last(removeInfo.windowId, true);

      debug.log("onRemoved currentTab", tabId, currentTab && currentTab.id, last, removeInfo, removedTab);

      if (!currentTab) //last tab in window
        return; 

      if (last.id === tabs[0].id)
        return;


    TABS.noChange = true;
    const windowId = removedTab.windowId;

    let index = removedTab.index,
        prevTab = TABS.last(windowId, true);

debug.log("remove", tabId, "prev", prevTab && prevTab.id, "cur", currentTab.id, prevTab && (prevTab.id != tabId && currentTab.id == prevTab.id));
  //  if ((prevTab && prevTab.id != tabId) || !prefs.afterClose)
    if (!prefs.afterClose || (prefs.afterClose == 1 && (prevTab && (prevTab.id != tabId && currentTab.id == prevTab.id))))
      return (TABS.noChange = false, debug.log("noChange", "exit remove", TABS.noChange));

    prevTab = TABS.last(windowId, true);
    if (!prevTab)
      prevTab = TABS.last(windowId);

    if (!prevTab)
      return;

debug.log("removing", tabId, prevTab.id, currentTab.id, "removed ind ", index, "cur ind", currentTab.index);
    const callback = tabs =>
    {
      TABS.noChange = false;
      TABS.activate(tabs[0].id)
      .catch(er=>debug.log(er));
    };

    if (prefs.afterClose == 1)
    {
      chrome.tabs.get(prevTab.id)
      .then(tab => callback([tab]))
      .catch(er => debug.error("onRemoved afterClose", er)); //previous active
    }
    else
    {
      chrome.tabs.query({
          index: [
              index && --index || 0, // left
              index                  // right
            ][prefs.afterClose-2],
          windowId: windowId
        })
      .then(callback);
debug.log([
              (index && --index) || 0, // left
              index                    // right
            ][prefs.afterClose-2], prefs.afterClose-2, (index && --index) || 0, index);
    }
/*
    switch (prefs.afterClose)
    {
      case 1: // last used tab
        chrome.tabs.update(tabsArray[0], {active: true});
        break;
      case 2: // left
        chrome.tabs.query({windowId: currentWindowId}, tabs =>
        {
          if (currentTabIndex > 0)
            currentTabIndex = currentTabIndex - 1;

          chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
        });
        break;
      case 3: // right
        chrome.tabs.query({windowId: currentWindowId}, tabs =>
        {
          if (currentTabIndex >= TABS.length)
            currentTabIndex = TABS.length - 1;

          chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
        });
        break;
      }
  */
      TABS.updateAll(windowId);
debug.log("remove win", TABS.win(windowId));
    });
  }, //onRemoved()

  onAttached: (tabId, attachInfo) =>
  {
    debug.log("onAttached", {tabId, attachInfo, data: Object.assign({}, TABS.find({id: tabId, windowId: attachInfo.newWindowId})||{})});
    TABS.updateAll(attachInfo.windowId);
    // TABS.update(TABS.find({id: tabId, windowId: attachInfo.newWindowId}), {id: tabId, windowId: attachInfo.newWindowId}, true);
    // TABS.save();
    debug.log("onAttached after", Object.assign({}, TABS.find({id: tabId, windowId: attachInfo.newWindowId})||{}));
  }, //onAttached()

  onDetached: (tabId, detachInfo) =>
  {
    debug.log("onDetached", {tabId, detachInfo, data: Object.assign({}, TABS.find({id: tabId, windowId: detachInfo.oldWindowId})||{})});
    TABS.updateAll(detachInfo.windowId);
    // TABS.update(TABS.find({id: tabId, windowId: detachInfo.oldWindowId}), {id: tabId, windowId: detachInfo.oldWindowId}, true);
    // TABS.save();
    debug.log("onDetached after", Object.assign({}, TABS.find({id: tabId, windowId: detachInfo.oldWindowId})||{}));
  }, //onDetached()

  // onMoved: (tabId, moveInfo) =>
  // {
  // debug.log("moved", tabId, moveInfo, Object.assign({}, TABS.find(tabId)));
  //   TABS.update({id: tabId, windowId: moveInfo.windowId, index: moveInfo.toIndex});
  // debug.log("moved end", TABS.find(tabId));
  // }, //onMoved()

  onReplaced: (addedTabId, removedTabId) =>
  {
    debug.log("onReplaced", {addedTabId, removedTabId});
    chrome.tabs.get(addedTabId)
    .then(tab =>
    {
      const removedTab = TABS.remove({id: removedTabId});
      TABS.update(tab, removedTab);
      TABS.add(tab, false);
      const callback = tabsHandler.onReplaced.callback;
      while(callback.length)
        callback.shift()({tab, oldTab: removedTab||TABS.find({id: removedTabId})});
  
    });
  }, //onReplaced()

  onUpdated: (tabId, changeInfo, tab) =>
  {
    debug.log("onUpdated", tabId, changeInfo);
    if (changeInfo.status === "loading")
    {
      setIcon(tab);
    }

  //   debug.log("onUpdated", {tabId, changeInfoStatus: changeInfo.status, tabStatus: tab.status, changeInfo, tab: JSON.parse(JSON.stringify(tab)), tabStored: TABS.find(tabId)});
  // //debug.log("onUpdated", tabId, changeInfo, changeInfo.status === "loading", Object.assign({}, tab));
  //   TABS.update(Object.assign(changeInfo, {id: tabId, windowId: tab.windowId}));
  // debug.log("onUpdated end", TABS.find(tabId,tab.windowId));
  }, //onUpdated()

  onMoved: (tabId, changeInfo, tab) =>
  {
    tab = tab || {id: tabId, windowId: changeInfo.windowId, index: changeInfo.toIndex};
    debug.log("onMoved", {tabId, changeInfo, tab: Object.assign({}, tab), found: Object.assign({}, TABS.find(tab))});
    TABS.updateAll(changeInfo.windowId);
  },

};//tabsEventHandler

tabsHandler.onReplaced.callback = [];

for(let i in tabsHandler)
  chrome.tabs[i].addListener(onWrapper(tabsHandler[i]));


chrome.runtime.onSuspend.addListener(() =>
{
  chrome.action.setBadgeBackgroundColor({color: red});
  debug.log("" + [...TABS.data.keys()]);
  TABS.save();
});

chrome.contextMenus.onClicked.addListener(onWrapper((info, tab) =>
{
  if (contextMenu.onClick[info.menuItemId] instanceof Function)
    contextMenu.onClick[info.menuItemId](info, tab);
}));

chrome.action.onClicked.addListener(onWrapper(actionButton));

chrome.sessions.onChanged.addListener((...args) =>
{
  debug.log("session.onChanged", args);
  onChange.createContextMenu();
});

function setContext(tab)
{
  const found = TABS.find(tab);
  onChange.createContextMenu("", "", "", {skip: {title: chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_" + ~~!found.skip)}});

}
/*
chrome.tabGroups.onUpdated(tabGroup =>
{
  debug.log("tabGroup updated", tabGroup);
});

*/



// chrome.webRequest.onBeforeRequest.addListener(

//   function(details) {

//     //just don't navigate at all if the requested url is example.com
//     if (details.url.indexOf("msn.com") != -1) {
// debug.log(details.url, TABS.find(details.tabId)&&TABS.find(details.tabId).url);
//       return {redirectUrl: 'http://google.com/gen_204'};

//     } else {

//       return { cancel: false };

//     }

//   },
//     { urls: ["<all_urls>"] },
//     ["blocking"]
// );



function tabsGet(id, callback)
{
  const cb = tabs => (chrome.runtime.lastError) ? setTimeout(e => chrome.tabs.get(id, cb)) : callback(tabs); //https://stackoverflow.com/questions/67887896
  chrome.tabs.get(id)
  .then(cb)
  .catch(er => debug.error("tabsGet", er));
}
function tabsQuery(query, callback)
{
  const cb = tabs => (chrome.runtime.lastError) ? setTimeout(e => chrome.tabs.query(query, cb)) : callback(tabs); //https://stackoverflow.com/questions/67887896
  return chrome.tabs.query(query)
          .then(cb)
          .catch(er => debug.error("tabsQuery", er));
}

function actionButton(tab, iconAction)
{
    if (iconAction === undefined)
      iconAction = prefs.iconAction;

    const found = TABS.find(tab) || tab;
  debug.log("actionButton", iconAction, tab.skip, found.skip, tab === found, tab, found);
    switch (iconAction)
    {
      case ACTION_UNDO:
        chrome.sessions.getRecentlyClosed(sessions => 
        {
  debug.log(sessions);
          const sessionId = sessions[0] && (sessions[0].tab && sessions[0].tab.sessionId) || (sessions[0].window && sessions[0].window.tabs[0] && sessions[0].window.tabs[0].sessionId) || null;
  debug.log(sessionId);
          chrome.sessions.restore(sessionId);
        });
        break;

      case ACTION_SKIP:
        found.skip = !found.skip;
        TABS.save();
        setIcon(found);
        setContext(found);
        break;

      // case ACTION_FREEZE:
      //   found.freeze = !found.freeze;
      //   setIcon(found);
      //   break;
  
      // case ACTION_PROTECT:
      //   found.protect = !found.protect;
      //   setIcon(found);
      //   break;

      case ACTION_LIST:
        const winOptions = {
          url: "ui/popup.html",
          type: "panel",
          focused: true,
          width: 335,
          height: 640
        };
        
        setIcon(tab, true);
        //get current window screen location
        chrome.windows.getCurrent(null, function(currWin)
        {
          if (currWin)
          {
            winOptions.left = currWin.left + Math.round((currWin.width - winOptions.width) / 2);
            winOptions.top = currWin.top + Math.round((currWin.height - winOptions.height) / 2);
          }
          
          chrome.windows.create(winOptions, function(win)
          {
  debug.log(win);
          });
        });
        break;

      case ACTION_UNLOAD_TAB:
        chrome.tabs.query({currentWindow: true, active: true})
        .then(tabs => unloadTabs(tabs, ACTION_UNLOAD_TAB));
        break;

      case ACTION_UNLOAD_WINDOW:
        chrome.tabs.query({currentWindow: true, active: false})
        .then(tabs => unloadTabs(tabs, ACTION_UNLOAD_WINDOW));
        break;

      case ACTION_UNLOAD_ALL:
        chrome.tabs.query({active: false})
        .then(tabs => unloadTabs(tabs, ACTION_UNLOAD_ALL));
        break;
    }//switch
}

function unloadTabs(tabs, type = ACTION_UNLOAD_TAB)
{
  for(let i = 0; i < tabs.length; i++)
  {
    const tab = tabs[i];
    const callback = () => chrome.tabs.discard(tab.id)
                            .catch(er => debug.error("unloadTabs", er));
    if (!tab.discarded)
    {
      debug.log("unloadTab", {id: tab.id, type, tab});
      if (type === ACTION_UNLOAD_TAB || type === ACTION_UNLOAD_WINDOW)
      {
        const prevTab = TABS.last(tab.windowId, true, [tab.id]);
        if (!prevTab)
          continue;

        TABS.activate(prevTab.id)
        .then(callback)
        .catch(er => debug.error("unloadTabs", er));
      }
      else
      {
        callback();
      }
    }
  }
}

/*
automatic switch between light/dark mode doesn't work in manifest3
const m = window.matchMedia('(prefers-color-scheme: dark)');
m.onchange = e => debug.log(tabsQuery({active: true}, tabs => setIcon(tabs.tabId)));
debug.log(m);
*/

function setIcon(tab)
{
  if (!tab)
    return debug.trace("setIcon error tab", tab);

  let title = app.name,
//      icon = "ui/icons/icon_",
      popup = "",
      open = ~~messagesHandler._tabs.has(tab.id),
      action = prefs.iconAction ? "enable" : "disable",
      skipped = TABS.find(tab) || tab,
      prop = ACTIONPROPS[prefs.iconAction],
      color = ["#8AB4F8", "#F88AAF", "#74839C", "#9B7783"][~~skipped[ACTIONPROPS[ACTION_SKIP]] + open*2],
      badge = skipped[ACTIONPROPS[ACTION_SKIP]] ? "☐" : "🗹";

  if (prefs.iconAction == ACTION_LIST)
  {
    popup = "ui/popup.html";
    badge += open ? " ▲" : " ▼";
  }
  else if (prefs.iconAction)
  {
    badge = badge + "" + chrome.i18n.getMessage("iconAction_" + prefs.iconAction+"_badge").padStart(2, " ");
  }

debug.trace("setIcon", {id: tab.id, badge, iconAction: prefs.iconAction, prop, open, tab, skipped, tabConnect: messagesHandler._tabs});
 if (badge.length < 3)
    badge = "  " + badge + "  ";

  if (prefs.iconAction == ACTION_SKIP)
  {
    title += "\n" + chrome.i18n.getMessage("iconAction_" + ACTION_SKIP + "_" + (skipped.skip ? "N" : "Y"));
  }
  else if (prefs.iconAction)
  {
    title += "\n" + chrome.i18n.getMessage("iconAction_" + prefs.iconAction);
  }
  chrome.action[action](tab.id).catch(()=>{});
  if (color)
    chrome.action.setBadgeBackgroundColor({color, tabId: tab.id}).catch(()=>{});

  chrome.action.setBadgeText({text: badge, tabId: tab.id}).catch(()=>{});
  chrome.action.setPopup({tabId: tab.id, popup: popup}).catch(()=>{});
  chrome.action.setTitle({tabId: tab.id, title: title}).catch(()=>{});
  debug.log({action, title, badge, popup});
  // abandon dynamic icons, icons are too small to show useful information
  // ICON.set(
  //   {
  //     skip: pinned[prop],
  //     action: prefs.iconAction,
  //     color
  //   }
  // );
  // ICON.setIcon(tab.id);
/*
  chrome.action.setIcon(
  {
    tabId: tab.id,
    path: {
      128: icon + "128.png",
      64: icon + "64.png",
      48: icon + "48.png",
      32: icon + "32.png",
      24: icon + "24.png",
      16: icon + "16.png",
    }
  });
*/
}
