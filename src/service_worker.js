// try {
//   importScripts("background.js");
// } catch (e) {
//   console.error(e);
// }
const app = chrome.runtime.getManifest();

importScripts("include/common.js");
importScripts("include/debug.js");
importScripts("include/tabsManager.js");
const TABS = new TabsManager();
importScripts("include/prefs.js");
onReplaced.callback = [];
String.prototype.truncate = String.prototype.truncate ||  function (n)
{
  return this.length > n ? this.substring(0, (n / 2) - 1) + '…' + this.substring(this.length - (n / 2) + 2, this.length) : this.toString();
//  return (this.length > n) ? this.substr(0, n-1) + '…' : this.toString();
};


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
    return (this.list.set(chrome.contextMenus.create(_menu, () =>
    {
      if (chrome.runtime.lastError)
      debug.error("contextMenu.add:", chrome.runtime.lastError.message, menuItem);
    else
      debug.log("contextMenu.add:", menuItem);

    }), menuItem));
  },
  remove: function(id)
  {
    const menuItem = this.list.get(id);
    if (menuItem)
    {
      chrome.contextMenus.remove(id, () =>
      {
        if (chrome.runtime.lastError)
          debug.error("contextMenu.add:", chrome.runtime.lastError.message, menuItem);
        else
          debug.log("contextMenu.add:", menuItem);
      });
    }
    this.list.delete(id);
  },
};


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
    debug.log("createContextMenu", id, newVal, oldVal, menus, force);
    if (menus === undefined)
      menus = ["lastUsed", "mark", /*"freeze", "protect",*/ "separator", "options", "separator", "list", "listAction"];

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

                chrome.tabs.update(lastTab.id, {active: true});
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
            mark: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_MARK),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_MARK);
              }
            },
            freeze: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_FREEZE),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_FREEZE);
              }
            },
            protect: {
              title: chrome.i18n.getMessage("iconAction_" + ACTION_PROTECT),
              contexts: contexts,
              onclick: (info, tab) =>
              {
                actionButton(tab, ACTION_PROTECT);
              }
            },
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
            }
          };
    for (let m = 0; m < menus.length; m++)
    {
      const itemId = menus[m],
            menuItem = menuList[itemId];

      if (menuItem === undefined)
        continue;

      menuItem.id = itemId;
      if (menuItem.type == "separator")
        menuItem.id += m;

      contextMenu.remove(menuItem.id);
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
debug.log(itemId, i, prefs.contextMenu, sessions[i]);
            if (!sessions[i] || (itemId === "list" && !prefs.contextMenu))
              break;
            
            const tabs = sessions[i].tab && [sessions[i].tab] || sessions[i].window.tabs;
            for(let n = 0; i++ < 10 && n < tabs.length; n++)
            {
              const tab = tabs[n];
              const details = {
                title: tab.title.truncate(50),
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

debug.log(itemId, i , details);
              contextMenu.add(details, true);
            }
          }
          while(i < max);
          for (; i <= max; i++)
          {
            console.log(itemId+i, contextMenu.list.get(itemId+i));
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
    console.log(Object.assign({}, list));
    for(let i in list)
    {
      list[i] = list[i].filter((a, i, ar) => a[1].type != "separator" || (i && ar[i-1][1].type != a[1].type));
    }
    console.log(list);
    // console.log([...contextMenu.list.entries()].filter((a, i, ar) => a[1].type != "separator" || (i && ar[i-1][1].type != a[1].type)));
  } //createContextMenu()

}; //onChange



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
      debug.log(request, sender);
  }
});


chrome.tabs.onActivated.addListener( activeInfo =>
{
  if (TABS.noChange)
    return;

//  tabsGet(activeInfo.tabId, tab => TABS.add(tab));
  tabsGet(activeInfo.tabId, tab => {
    TABS.add(tab);
    debug.log("activated", "noChange " + TABS.noChange, activeInfo.tabId, TABS.win(activeInfo.windowId));
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
    const index = [
      0,                  // first
      prevTab.index,      // next left
      prevTab.index + 1,  // next right
      -1                  // last
    ][prefs.newTabPosition-1];
debug.log("newTabPosition", prevTab.id,prefs.newTabPosition-1, index);
    chrome.tabs.move(tab.id, {index});
  }
// fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276
// is it fixed now?
  TABS.noChange = true;
debug.log("noChange", "true", TABS.noChange);

// without setTimeout it scrolls page down when link opens a new tab (and AutoControl installed https://chrome.google.com/webstore/detail/autocontrol-custom-shortc/lkaihdpfpifdlgoapbfocpmekbokmcfd )
// is it fixed now?
  // setTimeout(() => {
    chrome.tabs.update(prevTab.id, {active: true});
  // }, 35);

  // setTimeout(e => {
    TABS.noChange = false;
debug.log("noChange", "false", TABS.noChange);

    if (prefs.newTabActivate == 1 || tab.url.match(/^chrome/i))
      chrome.tabs.update(tab.id, {active: true}); // foreground
    else if (prefs.newTabActivate == 2 && !tab.url.match(/^chrome/i))
      chrome.tabs.update(prevTab.id, {active: true}); // background

    setIcon(tab);

  // }, 300);
    
debug.log("created", TABS.win(tab.windowId), prevTab, tab);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
{
  tabsQuery({active: true, windowId: removeInfo.windowId}, tabs =>
  {
    const removedTab = TABS.remove({id: tabId, windowId: removeInfo.windowId});
    activateTab(tabs[0], removedTab);
debug.log("remove win", TABS.win(removeInfo.windowId));
  });

});

chrome.tabs.onAttached.addListener(function(tabId, attachInfo)
{
//  TABS.add({id: tabId, windowId: attachInfo.newWindowId});
//  tabsGet(tabId, TABS.add);
  tabsGet(tabId, tab => 
  {
debug.log("attach", TABS.win());
    TABS.add(tab);
  });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) =>
{
  TABS.remove({id: tabId, windowId: detachInfo.oldWindowId});
  tabsGet(tabId, tab => TABS.add(tab));
debug.log("detach", TABS.win());
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) =>
{
debug.log("moved", tabId, moveInfo, Object.assign({}, TABS.find(tabId)));
  TABS.update({id: tabId, windowId: moveInfo.windowId, index: moveInfo.toIndex});
debug.log("moved end", TABS.find(tabId));
});

chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) =>
{
  if (changeInfo.status === "loading")
    setIcon(tab);
    debug.log("onUpdated", tabId, changeInfo.status, tab.status, changeInfo, JSON.parse(JSON.stringify(tab)));
//debug.log("onUpdated", tabId, changeInfo, changeInfo.status === "loading", Object.assign({}, tab));
  TABS.update(Object.assign(changeInfo, {id: tabId, windowId: tab.windowId}));
debug.log("onUpdated end", TABS.find(tabId,tab.windowId));
});

chrome.tabs.onReplaced.addListener(onReplaced);

chrome.contextMenus.onClicked.addListener((info, tab) =>
{
  if (contextMenu.onClick[info.menuItemId] instanceof Function)
    contextMenu.onClick[info.menuItemId](info, tab);
});

chrome.action.onClicked.addListener(actionButton);


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





function onReplaced(addedTabId, removedTabId)
{
  const removedTab = TABS.remove({id: removedTabId});
  console.log("onReplaced tab", TABS.find(addedTabId), TABS.find(addedTabId));
  chrome.tabs.get(addedTabId, tab =>
  {
    TABS.add(tab);
debug.log("onReplaced", {old: removedTabId, new: addedTabId, oldFound: TABS.find(removedTabId), newFound: TABS.find(addedTabId), removedTab});
    const callback = onReplaced.callback;
    while(callback.length)
      callback.shift()({tab, oldTab: removedTab||TABS.find(removedTabId)});

  });
}

function activateTab(currentTab, removedTab)
{
    if (!currentTab) //closed last tab in the window
      return;

    TABS.noChange = true;
    const tabId = removedTab.id,
          windowId = removedTab.windowId;

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
      const callback = tab =>
      {
        TABS.noChange = false;
        chrome.tabs.update(tab[0].id, {active: true}).catch(er=>console.log(er));
      };
  
      if (prefs.afterClose == 1)
        chrome.tabs.get(prevTab.id, tab => callback([tab])); //previous active
      else
        chrome.tabs.query({
            index: [
                index && --index || 0, // left
                index                             // right
              ][prefs.afterClose-2],
            windowId: windowId
          }, callback);
debug.log([
                (index && --index) || 0, // left
                index                             // right
              ][prefs.afterClose-2], prefs.afterClose-2, (index && --index) || 0, index);
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
debug.log("remove win", TABS.win(windowId));
}

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

// chrome.sessions.onChanged.addListener(function()
// {
//   // onChange.createContextMenu("", "", "", ["list", "listAction"], true);
// });

function actionButton(tab, iconAction)
{
  if (iconAction === undefined)
    iconAction = prefs.iconAction;

  const found = TABS.find(tab.id, tab.windowId) || tab;
debug.log("actionButton", iconAction, tab.skipAfterClose, found.skipAfterClose, tab === found, tab, found);
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

    case ACTION_UNLOAD:
      chrome.tabs.query({currentWindow: true, active: true}, unloadTabs);
      break;
  }
}

function unloadTabs(tabs)
{
  const callback = ({tab, oldTab}) =>
  {
    console.log("onReplaced.callback", tab, oldTab);
    activateTab(tab, oldTab);
  };
  for(let i = 0; i < tabs.length; i++)
  {
    if (!tabs[i].discarded)
    {
debug.log("unloadTabs", tabs[i]);
      onReplaced.callback.push(callback);
      chrome.tabs.discard(tabs[i].id);
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
  let title = app.name,
//      icon = "ui/icons/icon_",
      popup = "",
      action = prefs.iconAction ? "enable" : "disable",
      color = '#8AB4F8',//window.matchMedia('(prefers-color-scheme: dark)').matches ? "#393939" : "",
      pinned = TABS.find(tab.id, tab.windowId) || tab,
      prop = ["skipAfterClose", "freeze", "protect"][prefs.iconAction-3],
      badge = pinned[prop] ? " ❌ " : " 🟢 ";

  if (prefs.iconAction)
    badge = badge.replace(/ /g, '') + chrome.i18n.getMessage("iconAction_"+prefs.iconAction+"_badge");

  if (prefs.iconAction == ACTION_MARK)
  {
debug.log("setIcon", pinned.skipAfterClose ? 1 : 0, tab.skipAfterClose, pinned.skipAfterClose, tab === pinned, tab, pinned);
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
  chrome.action[action](tab.id);
  if (color)
    chrome.action.setBadgeBackgroundColor({color, tabId: tab.id});

  chrome.action.setBadgeText({text: badge, tabId: tab.id});
debug.log({action, title, badge, popup});
  chrome.action.setPopup({tabId: tab.id, popup: popup});
  chrome.action.setTitle(
  {
    tabId: tab.id,
    title: title
  });
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
