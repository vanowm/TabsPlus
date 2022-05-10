//jshint -W083
(()=>
{
var STORAGE = chrome.storage.sync;
const app = chrome.app.getDetails();
const prefs = function(name, value)
{
  if (value === undefined)
    return prefs[name];

  if (prefs[name] === undefined)
    return;

  const save = prefs[name];
  prefs.data[name].value = value;
  if (1 || save !== value)
  {
    const o = {};
    o[name] = value;
    prefsSave(o, er => console.log("prefsSave", o, er, chrome.runtime.lastError));
  }
  return save;
};

//options

Object.defineProperties(prefs, {
  data:
  {
    configurable: false,
    enumerable: false,
  //  writable: false,
    value:
    {
      newTabPosition:
      {
        default: 0,
      },
      newTabActivate:
      {
        default: 0,
      },
      afterClose:
      {
        default: 0,
      },
      iconAction:
      {
        default: 0,
        onChange: "iconActionChanged",
        group: "iconAction",
        valid: [0,ACTION_UNDO, ACTION_MARK, ACTION_LIST]
      },
      expandWindow:
      {
        default: 0,
        group: "iconAction"
      },
      contextMenu:
      {
        default: 0,
        onChange: "createContextMenu",
      },
      // syncSettings:
      // {
      //   default: 1,
      // },
      optWin:
      {
        noSync: true,
        default: ""
      },
      version:
      {
        noSync: true,
        default: ""
      }
    }
  }
});

STORAGE.get(null, prefsInit);

// storage change listener
chrome.storage.onChanged.addListener( prefsOnChanged );

// messaging
chrome.runtime.onMessage.addListener( (request, sender, sendResponse) =>
{
  if (sender.id !== chrome.runtime.id)
    return;

  switch (request.type)
  {
    case "prefs":
      sendResponse(prefs.data);
      break;
    case "pref":

      sendResponse(prefs(request.name, request.value));

      if (request.name == "syncSettings")
      {
        STORAGE = chrome.storage[request.value ? "sync" : "local"];
        const o = {};
        o[request.name] = request.value;
        prefsSave(o, ()=>{});
      }

      sendResponse("ok");
      break;
    default:
      console.log(request, sender);
  }
});

const list = function(map)
{
  this.data = map || new Map();
  return this;
};

list.prototype = 
{
  data: new Map(),
  noChange: false,
  add: function(tab)
  {
console.log(this);
    let data = this.data.get(tab.windowId);
    if (!data)
    {
      data = new Map();
      this.data.set(tab.windowId, data);
    }
    const _tab = this.remove(tab, true); //move tab to the end of the list
    data.set(tab.id, _tab || tab);
    if (_tab)
      TABS.update(tab);
  },

  remove: function(tab, noCheck)
  {
    const wIds = tab.windowId === undefined ? Array.from(this.data.keys()) : [tab.windowId];

    for(let i = 0; i < wIds.length; i++)
    { 
      let data = this.data.get(wIds[i]);

      if (data)
      {
        const r = data.get(tab.id);
        data.delete(tab.id);
        this.data.delete(wIds[i]);
        if (noCheck || (!noCheck && data.size))
          this.data.set(tab.windowId, data);

        return r;
      }
    }
  },

  find: function(id, windowId)
  {
    const data = windowId ? [this.data.get(windowId)] : Array.from(this.data.values());
    if (!data)
      return;

console.log(data);
    for(let i = 0, tab; i < data.length; i++)
    {
      if (!data[i])
        continue;

      tab = data[i].get(id);
      if (tab)
        return tab;
    }
  },

  update: function(tab)
  {
    const data = this.data.get(tab.windowId);
    if (!data)
      return;

    const oldTab = data.get(tab.id);
const _t = Object.assign({}, oldTab);
console.log(tab, _t);
    for(let i in tab)
    {
if (oldTab[i] !== tab[i]) console.log("tab change", i, tab[i], oldTab[i]);
      oldTab[i] = tab[i];
    }

console.log("tabs update", _t, data.get(tab.id));
  },

  last: function(windowId, skipAfterClose, skipIds)
  {
    skipIds = skipIds || [];
    let data;
    if (windowId)
      data = this.data.get(windowId) ? this.data.get(windowId).values() : [];
    else
      data = Array.from(this.data.values()).pop().values();

    data = Array.from(data);
    let tab;
    for(let i = data.length - 1; i >= 0; i--)
    {
      const tab = data[i];
console.log(tab.id);
      if ((!skipAfterClose || (skipAfterClose && !tab.skipAfterClose)) && skipIds.indexOf(tab.id) == -1)
        return tab;
    }
  },

  win: function(win)
  {
    if (win !== undefined && !(win instanceof Array))
      win = [win];

    const r = {},
          w = Array.from(this.data.keys());

    for (let i = 0; i < w.length; i++)
    {
      if (win && win.indexOf(w[i]) != -1)
        r[w[i]] = Array.from(this.data.get(w[i]).keys());
    }
    return JSON.stringify(r);
  }
}; // TABS.__proto__


for(let i in list.prototype)
{
  Object.defineProperty(list.prototype, i, {
    configurable: false,
    enumerable: false
  });
}
const TABS = new list();

chrome.tabs.onActivated.addListener( activeInfo =>
{
  if (TABS.noChange)
    return;

//  tabsGet(activeInfo.tabId, tab => TABS.add(tab));
  tabsGet(activeInfo.tabId, tab => {
    TABS.add(tab);
    console.log("activated", "noChange " + TABS.noChange, activeInfo.tabId, TABS.win(activeInfo.windowId));
  });
});

chrome.tabs.onCreated.addListener(tab =>
{
//  TABS.add({id: tabId, windowId: attachInfo.newWindowId});
  if (tab.pendingUrl && tab.pendingUrl === tab.url) //tab restored?
    return;

  let prevTab = TABS.last(tab.windowId);
  TABS.add(tab);
  if (!prevTab)
    prevTab = TABS.last(tab.windowId);

  if (prefs.newTabPosition)
  {
console.log("newTabPosition", prevTab.id,prefs.newTabPosition-1,
[
0,                  // first
prevTab.index,      // next left
prevTab.index + 1,  // next right
-1                  // last
][prefs.newTabPosition-1]);
    chrome.tabs.move(tab.id, {index: [
      0,                  // first
      prevTab.index,      // next left
      prevTab.index + 1,  // next right
      -1                  // last
      ][prefs.newTabPosition-1]
    });
  }
// fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276
   TABS.noChange = true;
console.log("noChange", "true", TABS.noChange);

//without setTimeout it scrolls page down when link opens a new tab (and AutoControl installed https://chrome.google.com/webstore/detail/autocontrol-custom-shortc/lkaihdpfpifdlgoapbfocpmekbokmcfd )
  setTimeout(() => {
    chrome.tabs.update(prevTab.id, {active: true});
  }, 35);

  setTimeout(e =>
  {
    TABS.noChange = false;
console.log("noChange", "false", TABS.noChange);

    if (prefs.newTabActivate == 1 || tab.url.match(/^chrome/i))
      chrome.tabs.update(tab.id, {active: true}); // foreground
    else if (prefs.newTabActivate == 2 && !tab.url.match(/^chrome/i))
      chrome.tabs.update(prevTab.id, {active: true}); // background
chrome.tabs.get(tab.id, (tab)=>console.log(tab));

    setIcon(tab);

  }, 300);
    
console.log("created", TABS.win(tab.windowId), prevTab, tab);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
{
  tabsQuery({active: true, windowId: removeInfo.windowId}, tabs =>
  {
    const removedTab = TABS.remove({id: tabId, windowId: removeInfo.windowId}),
          currentTab = tabs[0];

    if (!currentTab) //closed last tab in the window
      return;

    TABS.noChange = true;
    let prevTab = TABS.last(removeInfo.windowId, true);
console.log("remove", tabId, "prev", prevTab && prevTab.id, "cur", currentTab.id, prevTab && (prevTab.id != tabId && currentTab.id == prevTab.id));
  //  if ((prevTab && prevTab.id != tabId) || !prefs.afterClose)
    if (!prefs.afterClose || (prefs.afterClose == 1 && (prevTab && (prevTab.id != tabId && currentTab.id == prevTab.id))))
      return (TABS.noChange = false, console.log("noChange", "exit remove", TABS.noChange));

    prevTab = TABS.last(removeInfo.windowId, true);
    if (!prevTab)
      prevTab = TABS.last(removeInfo.windowId);

    if (!prevTab)
      return;

console.log("removing", tabId, prevTab.id, currentTab.id, "removed ind ", removedTab.index, "cur ind", currentTab.index);
      const callback = tab =>
      {
        TABS.noChange = false;
        chrome.tabs.update(tab[0].id, {active: true});
      };
 
      if (prefs.afterClose == 1)
        chrome.tabs.get(prevTab.id, tab => callback([tab])); //previous active
      else
        chrome.tabs.query({
            index: [
                removedTab.index && --removedTab.index || 0, // left
                removedTab.index                             // right
              ][prefs.afterClose-2],
            windowId: removeInfo.windowId
          }, callback);
console.log([
                (removedTab.index && --removedTab.index) || 0, // left
                removedTab.index                             // right
              ][prefs.afterClose-2], prefs.afterClose-2, (removedTab.index && --removedTab.index) || 0, removedTab.index);
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
console.log("remove win", TABS.win(removeInfo.windowId));
  });

});

chrome.tabs.onAttached.addListener(function(tabId, attachInfo)
{
//  TABS.add({id: tabId, windowId: attachInfo.newWindowId});
//  tabsGet(tabId, TABS.add);
  tabsGet(tabId, tab => 
  {
console.log("attach", TABS.win());
    TABS.add(tab);
  });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) =>
{
  TABS.remove({id: tabId, windowId: detachInfo.oldWindowId});
  tabsGet(tabId, tab => TABS.add(tab));
console.log("detach", TABS.win());
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) =>
{
console.log("moved", tabId, moveInfo, Object.assign({}, TABS.find(tabId)));
  TABS.update({id: tabId, windowId: moveInfo.windowId, index: moveInfo.toIndex});
console.log("moved end", TABS.find(tabId));
});

chrome.browserAction.onClicked.addListener(browserAction);

chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) =>
{
  if (changeInfo.status === "loading")
    setIcon(tab);
console.log("onUpdated", tabId, changeInfo.status, tab.status, changeInfo, JSON.parse(JSON.stringify(tab)));
//console.log("onUpdated", tabId, changeInfo, changeInfo.status === "loading", Object.assign({}, tab));
  TABS.update(Object.assign(changeInfo, {id: tabId, windowId: tab.windowId}));
console.log("onUpdated end", TABS.find(tabId,tab.windowId));
});

chrome.tabs.onReplaced.addListener( (addedTabId, removedTabId) =>
{
  TABS.remove({id: removedTabId});
console.log("onReplaced", addedTabId, removedTabId, TABS.find(addedTabId), TABS.find(removedTabId));
});



/*
chrome.tabGroups.onUpdated(tabGroup =>
{
  console.log("tabGroup updated", tabGroup);
});

*/



// chrome.webRequest.onBeforeRequest.addListener(

//   function(details) {

//     //just don't navigate at all if the requested url is example.com
//     if (details.url.indexOf("msn.com") != -1) {
// console.log(details.url, TABS.find(details.tabId)&&TABS.find(details.tabId).url);
//       return {redirectUrl: 'http://google.com/gen_204'};

//     } else {

//       return { cancel: false };

//     }

//   },
//     { urls: ["<all_urls>"] },
//     ["blocking"]
// );








function prefsOnChanged(changes, area)
{
console.log("prefsOnChanged", arguments);
  if (area == "sync" && STORAGE !== chrome.storage.sync)
    return;

  for (let o in changes)
  {
    if (!prefs.data[o])
      continue;

    if (onChange[prefs.data[o].onChange] instanceof Function)
      onChange[prefs.data[o].onChange](o, changes[o].newValue, changes[o].oldValue);

    chrome.runtime.sendMessage(null,
    {
      type: "prefChanged",
      name: o,
      newValue: changes[o].newValue,
      oldValue: changes[o].oldValue
    }, resp => console.log(o, resp, chrome.runtime.lastError));
  }
}

function prefsSave(o, callback)
{
console.log(STORAGE === chrome.storage.local, o);
  if (STORAGE === chrome.storage.local)
    return STORAGE.set(o, callback);

  const local = {},
        sync = {};

  for(let i in o)
  {
    if (prefs.data[i].noSync || i == "syncSettings")
      local[i] = o[i];
    else
      sync[i] = o[i];
  }
console.log("local", local);
console.log("sync", sync);
  if (Object.keys(local).length)
    chrome.storage.local.set(local, callback);

  if (Object.keys(sync).length)
    chrome.storage.sync.set(sync, callback);
}

function prefsInit(options, type)
{
  const save = {};

  for (let i in prefs.data)
  {

    let d = chrome.i18n.getMessage(i),
        n = 0,
        valid = prefs.data[i].valid || [];

    if (d)
      prefs.data[i].label = d;
    
    d = chrome.i18n.getMessage(i + "_desc");
    if (d)
      prefs.data[i].description = d;

    if (!valid.length)
    {
      do
      {
          d = chrome.i18n.getMessage(i + "_" + n);
          if (d)
          {
            valid[valid.length] = n;
          }

        n++;
      }
      while(d);
    }
    for(let n = 0; n < valid.length; n++)
    {

      d = chrome.i18n.getMessage(i + "_" + n);
      if (!d)
        continue;

      if (!prefs.data[i].options)
        prefs.data[i].options = [];

      prefs.data[i].options[n] = {name: d, description: chrome.i18n.getMessage(i + "_" + n + "_desc")};
    }
  }
  const remove = [];
  for (let i in options)
  {
    if (prefs.data[i] && typeof prefs.data[i].default == typeof options[i])
      prefs.data[i].value = options[i];
    else
      remove[remove.length] = i;
  }

  if (remove.length)
    STORAGE.remove(remove);

  const local = [];
  for (let i in prefs.data)
  {
    if (prefs.data[i].noSync && type == "sync")
    {
//      delete prefs.data[i];
      local[local.length] = i;
      continue;
    }
    if (prefs.data[i].value === undefined)
      prefs.data[i].value = save[i] = prefs.data[i].default;

    try
    {
      Object.defineProperty(prefs, i,
      {
        enumerable: true,
        configurable: false,
        get()
        {
          return this.data[i].value;
        },
        set(val)
        {
          this(i, val);
        }
      });
    }catch(e){}
  }




console.log(JSON.stringify(prefs.data, null, 2), type);
//alert("startup prefs with sync off are overwritten by sync.");

  if (type === undefined && prefs.syncSettings && STORAGE !== chrome.storage.sync)
  {
    STORAGE = chrome.storage.sync;
    chrome.storage.local.set({syncSettings: 1}, res=>res&&console.log(res));
    return STORAGE.get(null, e => prefsInit(e, "sync"));
  }
  else if (type === undefined && !prefs.syncSettings && STORAGE !== chrome.storage.local)
  {
    chrome.storage.local.set({syncSettings: 0}, res=>res&&console.log(res));
    STORAGE = chrome.storage.local;
    return STORAGE.get(null, e => prefsInit(e, "local"));
  }
console.log(type, local, options);

  if (local.length)
  {
    chrome.storage.local.get(local, e => prefsInit(e, "local"));
    return;
  }
  if (app.version != prefs.version)
  {
    save.version = app.version;
  }

console.log(JSON.stringify(prefs.data, null, 2),save, type);
  if (Object.keys(save).length)
    prefsSave(save, er => console.log("init prefs", save, er));

  chrome.tabs.query({}, list =>
  {
    let active = {};
    for(let i = 0; i < list.length; i++)
    {
      if (list[i].active)
        active[list[i].windowId] = list[i];

      TABS.add(list[i]);
      setIcon(list[i]);
    }
    for(let i in active)
      TABS.add(active[i]);

    // set action button
  //  onChange.iconActionChanged();


  });
  // context menu
  onChange.createContextMenu();


} //prefsInit();

function tabsGet(id, callback)
{
  const cb = tab => (chrome.runtime.lastError) ? setTimeout(e => chrome.tabs.get(id, cb)) : callback(tab); //https://stackoverflow.com/questions/67887896
  chrome.tabs.get(id, cb);
}
function tabsQuery(query, callback)
{
  const cb = tab => (chrome.runtime.lastError) ? setTimeout(e => chrome.tabs.query(query, cb)) : callback(tab); //https://stackoverflow.com/questions/67887896
  chrome.tabs.query(query, cb);
}

function createContextMenu (menu, force)
{
  if (createContextMenu.list[menu.id])
  {
//    if (!force)
//      return menu;

    chrome.contextMenus.remove(menu.id);
  }
  return (createContextMenu.list[chrome.contextMenus.create(menu)] = menu);
}
createContextMenu.list = {};
const onChange = {
  iconActionChanged: (id, newVal, oldVal) =>
  {
    chrome.tabs.query({}, tabs =>
    {
      for (var i = 0; i < tabs.length; i++)
      {
        setIcon(tabs[i]);
      }
    });
  },

  createContextMenu: (id, newVal, oldVal, menus, force) =>
  {
    console.log("createContextMenu", id, newVal, oldVal, menus, force);
    if (menus === undefined)
      menus = ["lastUsed", "mark", /*"freeze", "protect",*/ "sep1", "options", "sep2", "list", "listAction"];

    const contexts = prefs.contextMenu ? ["page", "frame", "browser_action", "page_action", "action"] : ["browser_action", "page_action", "action"],
          menuList = {
            lastUsed: {
              title: chrome.i18n.getMessage("contextMenu_lastUsed"),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                const lastTab = TABS.last(tab.windowId, true, [tab.id]);
                if (!lastTab)
                  return; 

                chrome.tabs.update(lastTab.id, {active: true});
              }
            },
            undo: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_UNDO),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                browserAction(tab, ACTION_UNDO);
              }
            },
            mark: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_MARK),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                browserAction(tab, ACTION_MARK);
              }
            },
            freeze: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_FREEZE),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                browserAction(tab, ACTION_FREEZE);
              }
            },
            protect: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_PROTECT),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                browserAction(tab, ACTION_PROTECT);
              }
            },
            list: {
              title: "----- [ " + chrome.i18n.getMessage("contextMenu_closedTabs") + " ] -----",
              contexts: ["page", "frame"],
              enabled: false,
              onclick: (info, tab) =>
              {
                browserAction(tab, ACTION_LIST);
              }
            },
            listAction: {
              title: chrome.i18n.getMessage("contextMenu_closedTabs"),
              contexts: ["browser_action", "page_action", "action"]
            },
            sep1: {
              type: "separator",
              contexts: prefs.contextMenu ? ["page", "frame", "action"] : ["action"],
            },
            sep2: {
              type: "separator",
              contexts: contexts,
            },
            options: {
              title: chrome.i18n.getMessage("options"),
              contexts: prefs.contextMenu ? ["page", "frame", "action"] : ["action"],
              onclick: (info, tab) =>
              {
                chrome.runtime.openOptionsPage();
              }
            }
          };
    for (let m = 0; m < menus.length; m++)
    {
      const menu = menuList[menus[m]];
      if (menu === undefined)
        continue;

console.log(menus[m]);
      if (menus[m] == "list" || menus[m] == "listAction")
      {
        const listAction = menus[m] == "listAction";
console.log(listAction);
        chrome.sessions.getRecentlyClosed(sessions => 
        {
console.log(listAction);
          if (sessions.length)
          {
            menu.id = menus[m];
            createContextMenu(menu, menu.id != "list" && force);
          }
          let i = 0,
              max = 10;
          do
          {
            const id = "list" + i;
            if (!sessions[i])
              break;

            const tabs = sessions[i].tab && [sessions[i].tab] || sessions[i].window.tabs;
            for(let n = 0; n < tabs.length && i < 10; n++)
            {
              const details = {
                title: tabs[n].title.truncate(50),
                id: id,
                contexts: contexts,
                onclick: e =>
                {
                  chrome.sessions.restore(tabs[n].sessionId);
                }
              };
              if (menus[m] == "listAction")
                details.parentId = "listAction";

console.log(listAction, details);
              createContextMenu(details, true);
              i++;
            }
          }
          while(i < max);
          for (; i < max; i++)
          {
            if (createContextMenu.list["list"+i])
            {
              chrome.contextMenus.remove("list"+i);
            }
          }
        });
        continue;
      }
      if (menu)
      {
        menu.id = menus[m];
        createContextMenu(menu, menu.id != "list" && force);
      }
    }
  } //createContextMenu()

};
String.prototype.truncate = String.prototype.truncate ||  function (n)
{
  return this.length > n ? this.substring(0, (n / 2) - 1) + '…' + this.substring(this.length - (n / 2) + 2, this.length) : this.toString();
//  return (this.length > n) ? this.substr(0, n-1) + '…' : this.toString();
};

chrome.sessions.onChanged.addListener(function()
{
  onChange.createContextMenu("", "", "", ["list"], true);
});

function browserAction(tab, iconAction)
{
  if (iconAction === undefined)
    iconAction = prefs.iconAction;

  const found = TABS.find(tab.id, tab.windowId) || tab;
console.log("browserAction", iconAction, tab.skipAfterClose, found.skipAfterClose, tab === found, tab, found);
  switch (iconAction)
  {
    case ACTION_UNDO:
      chrome.sessions.getRecentlyClosed(sessions => 
      {
console.log(sessions);
        const sessionId = sessions[0] && (sessions[0].tab && sessions[0].tab.sessionId) || (sessions[0].window && sessions[0].window.tabs[0] && sessions[0].window.tabs[0].sessionId) || null;
console.log(sessionId);
        chrome.sessions.restore(sessionId);
      });
      break;

    case ACTION_MARK:
      found.skipAfterClose = !found.skipAfterClose;
      setIcon(found);
      break;

    case ACTION_FREEZE:
      found.freeze = !found.freeze;
      setIcon(found);
      break;
 
    case ACTION_PROTECT:
      found.protect = !found.protect;
      setIcon(found);
      break;

    case ACTION_LIST:
      const winOptions = {
        url: "ui/popup.html",
        type: "panel",
        focused: true,
        width: 335,
        height: 640
      };
      
      //get current window screen location
      chrome.windows.getCurrent(null, function(currWin){
        if (currWin){
          winOptions.left = currWin.left + Math.round((currWin.width - winOptions.width) / 2);
          winOptions.top = currWin.top + Math.round((currWin.height - winOptions.height) / 2);
        }
        
        chrome.windows.create(winOptions, function(win){
console.log(win);
        });
      });
      break;

  }
}

const m = window.matchMedia('(prefers-color-scheme: dark)');
m.onchange = e => console.log(tabsQuery({active: true}, tabs => setIcon(tabs.tabId)));
console.log(m);

function setIcon(tab)
{
  let title = chrome.app.getDetails().name,
//      icon = "ui/icons/icon_",
      popup = "",
      action = prefs.iconAction ? "enable" : "disable",
      color = '',//window.matchMedia('(prefers-color-scheme: dark)').matches ? "#393939" : "",
      pinned = TABS.find(tab.id, tab.windowId) || tab,
      prop = ["skipAfterClose", "freeze", "protect"][prefs.iconAction-2],
      badge = (prefs.iconAction == ACTION_MARK ? pinned[prop] : !pinned[prop]) ? " ❌ " : " 🟢 ";

  if (prefs.iconAction)
    badge = badge.replace(/ /g, '') + chrome.i18n.getMessage("iconAction_"+prefs.iconAction+"_badge");

  if (prefs.iconAction == ACTION_MARK)
  {
console.log("setIcon", pinned.skipAfterClose ? 1 : 0, tab.skipAfterClose, pinned.skipAfterClose, tab === pinned, tab, pinned);
    title += "\n" + chrome.i18n.getMessage("iconAction_" + ACTION_MARK + "_" + (pinned.skipAfterClose ? "N" : "Y"));
//    icon += (pinned.skipAfterClose ? "un" : "") + "checked_";
  }
  else if (prefs.iconAction)
  {
    title += "\n" + chrome.i18n.getMessage("iconAction_" + prefs.iconAction);
  }
  if (prefs.iconAction == ACTION_LIST)
  {
    popup = "ui/popup.html";
  }
  chrome.browserAction[action](tab.id);
  if (color)
    chrome.browserAction.setBadgeBackgroundColor({color, tabId: tab.id});

  chrome.browserAction.setBadgeText({text: badge, tabId: tab.id});
console.log(action, title, popup);
  chrome.browserAction.setPopup({tabId: tab.id, popup: popup});
  chrome.browserAction.setTitle(
  {
    tabId: tab.id,
    title: title
  });
/*
  chrome.browserAction.setIcon(
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


return;





/*
// variables
var currentTabIndex = 0,
    currentTabId = 0,
    currentWindowId = 0,
    tabsArray = [],
    pinnedTabsArray = [],
    fromOnRemoved = false;


// events
chrome.tabs.query({currentWindow: true, active: true}, tabs =>
{
  currentTabIndex = tabs[0].index;
  currentTabId = tabs[0].id;
  currentWindowId = tabs[0].windowId;
});

chrome.tabs.query({currentWindow: true}, tabs =>
{
  if (pinnedTabsArray[currentWindowId] === undefined)
    pinnedTabsArray[currentWindowId] = [];

  for (let i = currentTabIndex; i < tabs.length; i++)
  {
    tabsArray.push(tabs[i].id);
    chrome.pageAction.show(tabs[i].id);
    if (tabs[i].pinned == true)
      pinnedTabsArray[currentWindowId].push(tabs[i].id);
  }
  for (let i = currentTabIndex - 1; i >= 0; i--)
  {
    tabsArray.push(tabs[i].id);
    chrome.pageAction.show(tabs[i].id);
    if (tabs[i].pinned == true)
      pinnedTabsArray[currentWindowId].push(tabs[i].id);
  }
  // set action button
  pinActionChanged();

});

chrome.tabs.onRemoved.addListener( (tabId, removeInfo) =>
{
  fromOnRemoved = true;
  if (tabsArray.indexOf(tabId) != -1)
    tabsArray.splice(tabsArray.indexOf(tabId), 1);

  if (pinnedTabsArray[currentWindowId].indexOf(tabId) != -1)
    pinnedTabsArray[currentWindowId].splice(pinnedTabsArray[currentWindowId].indexOf(tabId), 1);

  if (currentTabId == tabId)
  {
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
          if (currentTabIndex >= tabs.length)
            currentTabIndex = tabs.length - 1;

          chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
        });
        break;
    }
  }
  else
    fromOnRemoved = false;
});

chrome.tabs.onCreated.addListener( tab =>
{
  if (!fromOnRemoved)
  {
    switch (prefs.newTabPosition)
    {
      case 1: // first
        chrome.tabs.move(tab.id, {index: pinnedTabsArray[tab.windowId].length});
        break;
      case 4: // last
        chrome.tabs.move(tab.id, {index: -1});
        break;
      case 2: // next left
        chrome.tabs.get(currentTabId, function(selectedTab)
        {
          let moveToIndex = selectedTab.index;
          if (moveToIndex < pinnedTabsArray[tab.windowId].length)
            moveToIndex = pinnedTabsArray[tab.windowId].length;

          chrome.tabs.move(tab.id, {index: moveToIndex});
        });
        break;
      case 3: // next right
        chrome.tabs.get(currentTabId, function(selectedTab)
        {
console.log(pinnedTabsArray, tab);
          let moveToIndex = selectedTab.index + 1;
          if (moveToIndex < pinnedTabsArray[tab.windowId].length)
            moveToIndex = pinnedTabsArray[tab.windowId].length;

          chrome.tabs.move(tab.id, {index: moveToIndex});
        });

        break;
    }
  }
  // fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276
  chrome.tabs.get(currentTabId, selectedTab =>
  {
    chrome.tabs.update(selectedTab.id, {active: true});
    setTimeout(() =>
    {
      if (fromOnRemoved || (prefs.newTabActivate == 1))
        chrome.tabs.update(tab.id, {active: true}); // foreground
      else if (prefs.newTabActivate == 2 && !tab.url.match(/^chrome/))
        chrome.tabs.update(currentTabId, {active: true}); // background

      tabsArray.push(tab.id);
      setIcon(tab.id);
    }, 200);
  });
});

chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) =>
{
  switch (changeInfo.pinned)
  {
    case true:
      pinnedTabsArray[tab.windowId].splice(pinnedTabsArray[tab.windowId].indexOf(tabId), 1);
      pinnedTabsArray[tab.windowId].push(tabId);
      break;
    case false:
      pinnedTabsArray[tab.windowId].splice(pinnedTabsArray[tab.windowId].indexOf(tabId), 1);
      break;
  }
  setIcon(tabId);
});

chrome.tabs.onActivated.addListener( activeInfo =>
{
  currentTabId = activeInfo.tabId;
  currentWindowId = activeInfo.windowId;
  tabsGet(activeInfo.tabId, selectedTab =>
  {
    currentTabIndex = selectedTab.index;
    if (!fromOnRemoved && (tabsArray.indexOf(activeInfo.tabId) != -1 || !prefs.pinAction))
    {
      tabsArray.splice(tabsArray.indexOf(activeInfo.tabId), 1);
      tabsArray.splice(0, 0, activeInfo.tabId);
    }
    fromOnRemoved = false;
    setIcon(activeInfo.tabId);
  });
});

chrome.tabs.onMoved.addListener( (tabId, moveInfo) =>
{
  currentWindowId = moveInfo.windowId;
  currentTabIndex = moveInfo.toIndex;
});

chrome.tabs.onDetached.addListener( (tabId, detachInfo) =>
{
  pinnedTabsArray[detachInfo.oldWindowId].splice(pinnedTabsArray[detachInfo.oldWindowId].indexOf(tabId), 1);
});

chrome.tabs.onAttached.addListener( (tabId, attachInfo) =>
{
  if (pinnedTabsArray[attachInfo.newWindowId] === undefined)
    pinnedTabsArray[attachInfo.newWindowId] = [];

  pinnedTabsArray[attachInfo.newWindowId].push(tabId);
});

chrome.pageAction.onClicked.addListener( tab =>
{
  chrome.tabs.query(
  {
    currentWindow: true,
    active: true
  }, function(tabs)
  {
    if (tabsArray.indexOf(tab.id) == -1)
      tabsArray.splice(0, 0, tab.id);
    else
      tabsArray.splice(tabsArray.indexOf(tab.id), 1);

    setIcon(tab.id);
  });
});

// functions

function pinActionChanged()
{
  chrome.tabs.query({}, tabs =>
  {
    for (var i = 0; i < tabs.length; i++)
    {
      setIcon(tabs[i].id);
    }
  });
}

function setIcon(tabId)
{
  if (prefs.pinAction)
  {
    if (tabsArray.indexOf(tabId) == -1)
    {
      chrome.pageAction.setIcon(
      {
        path: "pin.png",
        tabId: tabId
      });
      chrome.pageAction.setTitle(
      {
        title: "Unpin tab\n\n[ USE  it for Last Used Order ]",
        tabId: tabId
      });
    }
    else
    {
      chrome.pageAction.setIcon(
      {
        path: "unpin.png",
        tabId: tabId
      });
      chrome.pageAction.setTitle(
      {
        title: "Pin tab\n\n[ DON'T USE  it for Last Used Order ]",
        tabId: tabId
      });
    }
    chrome.pageAction.show(tabId);
  }
  else
    chrome.pageAction.hide(tabId);
}

function lastUsedTabSelect(info, tab)
{
  if (tabsArray[0] == tab.id)
  {
    tabsArray.push(tabsArray[0]);
    tabsArray.splice(0, 1);
  }
  chrome.tabs.update(tabsArray[0],
  {
    active: true
  });
}

*/
})();