// variables
var currentTabIndex = 0,
    currentTabId = 0,
    currentWindowId = 0,
    tabsArray = [],
    pinnedTabsArray = [],
    fromOnRemoved = false,
    STORAGE = chrome.storage.sync;

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
    prefsSave(o, (er) => console.log("prefsSave", o, er, chrome.runtime.lastError));
  }
  return save;
};

//options

Object.defineProperty(prefs, "data",
{
  configurable: false,
  enumerable: false,
  value:
  {
    newTabPosition:
    {
      label: "Position of a new tab",
      default: 0,
      options: ["Default", "First", "Next left", "Next right", "Last"]
    },
    newTabActivate:
    {
      label: "Open a new tab in",
      default: 0,
      options: ["Default", "Foreground", "Background"]
    },
    afterDelete:
    {
      label: "After closing open",
      description: "Which tab to open after closing a tab",
      default: 0,
      options: ["Default", "Last used tab", "Left", "Right"]
    },
    pinAction:
    {
      label: "Use pin-unpin button",
      description: 'This will allow set a tab to prevent from being switched to after closing a tab and "After closing go to" is set to "Last used tab"',
      default: 0,
      onChange: pinActionChanged,
      options: ["No", "Yes"]
    },
    contextMenu:
    {
      label: "Use context menu",
      default: 0,
      onChange: createContextMenu,
      options: ["No", "Yes"]
    },
    syncSettings:
    {
      label: "Sync settings",
      description: "Sync settings between browsers",
      default: 0,
      options: ["No", "Yes"]
    },
    version:
    {
      default: ""
    }
  }
})

STORAGE.get(null, prefsInit);

// storage change listener
chrome.storage.onChanged.addListener( (changes, area) =>
{
  for (let o in changes)
  {
    if (!prefs.data[o])
      continue;

    if (prefs.data[o].onChange instanceof Function)
      prefs.data[o].onChange();

    chrome.runtime.sendMessage(null,
    {
      type: "prefChanged",
      name: o,
      newValue: changes[o].newValue,
      oldValue: changes[o].oldValue
    }, resp => console.log(resp, chrome.runtime.lastError));
  }
});

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
  }
});

// context menu
createContextMenu();


const tabs = new Map();
Object.defineProperties(tabs,
{
  add: {
    configurable: false,
    enumerable: false,
    value: function(tab)
    {
      let data = tabs.get(tab.windowId);
      if (!data)
      {
        data = new Map();
        tabs.set(tab.windowId, data);
      }
      tabs.remove(tab); //move tab to the end of the list
      data.set(tab.id, tab);
    }
  },

  remove: {
    configurable: false,
    enumerable: false,
    value: function(tab)
    {
      let data = tabs.get(tab.windowId);

      if (data)
      {
        data.delete(tab.id);
        tabs.delete(tab.windowId);
        tabs.set(tab.windowId, data);
      }
    }
  },

  update: {
    configurable: false,
    enumerable: false,
    value: function(tab)
    {
      const data = tabs.get(tab.windowId);
      for(let [key, value] of data)
      {
console.log(value);
      }
    }
  },
  last: {
    configurable: false,
    enumerable: false,
    value: function(windowId)
    {
      let data;
      if (windowId)
        data = tabs.get(windowId).keys();
      else
        data = Array.from(tabs.values()).pop().keys();

      return Array.from(data).pop();
    }
  }
});

chrome.tabs.onActivated.addListener( activeInfo =>
{
  tabsGet(activeInfo.tabId, tabs.add);
  console.log(tabs);
});

function tabsGet(id, callback)
{
  setTimeout(e => //https://stackoverflow.com/questions/67887896
  {
    chrome.tabs.get(id, tab =>
    {
      if (tab)
        callback(tab);
    });
  }, 200);
}

chrome.tabs.onCreated.addListener(tab =>
{
//  tabs.add({id: tabId, windowId: attachInfo.newWindowId});
  tabs.add(tab);
console.log("created", tabs);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
{
  tabs.remove({id: tabId, windowId: removeInfo.windowId});
console.log("remove", tabs);

});

chrome.tabs.onAttached.addListener(function(tabId, attachInfo)
{
console.log("attached", arguments);
//  tabs.add({id: tabId, windowId: attachInfo.newWindowId});
//  tabsGet(tabId, tabs.add);
  tabsGet(tabId, tab => 
  {
console.log("attach", tabs);
    tabs.add(tab);
  });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) =>
{
  tabs.remove({id: tabId, windowId: detachInfo.oldWindowId});
  tabsGet(tabId, tabs.add);
console.log("detach", tabs);
});

chrome.tabs.query({}, list =>
{
  for(let i = 0; i < list.length; i++)
  {
    tabs.add(list[i]);
  }
  console.log(tabs);
});




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
    switch (prefs.afterDelete)
    {
      case 1: /* last used tab */
        chrome.tabs.update(tabsArray[0], {active: true});
        break;
      case 2: /* left */
        chrome.tabs.query({windowId: currentWindowId}, tabs =>
        {
          if (currentTabIndex > 0)
            currentTabIndex = currentTabIndex - 1;

          chrome.tabs.update(tabs[currentTabIndex].id, {active: true});
        });
        break;
      case 3: /* right */
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
      case 1: /* first */
        chrome.tabs.move(tab.id, {index: pinnedTabsArray[tab.windowId].length});
        break;
      case 4: /* last */
        chrome.tabs.move(tab.id, {index: -1});
        break;
      case 2: /* next left */
        chrome.tabs.get(currentTabId, function(selectedTab)
        {
          let moveToIndex = selectedTab.index;
          if (moveToIndex < pinnedTabsArray[tab.windowId].length)
            moveToIndex = pinnedTabsArray[tab.windowId].length;

          chrome.tabs.move(tab.id, {index: moveToIndex});
        });
        break;
      case 3: /* next right */
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
  /* fix for EDGE vertical tabs don't scroll to the new tab https://github.com/MicrosoftDocs/edge-developer/issues/1276 */
  chrome.tabs.get(currentTabId, selectedTab =>
  {
    chrome.tabs.update(selectedTab.id, {active: true});
    setTimeout(() =>
    {
      if (fromOnRemoved || (prefs.newTabActivate == 1))
        chrome.tabs.update(tab.id, {active: true}); /* foreground */
      else if (prefs.newTabActivate == 2 && !tab.url.match(/^chrome/))
        chrome.tabs.update(currentTabId, {active: true}); /* background */

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
function prefsSave(o, callback)
{
  STORAGE.set(o, callback);
}

function prefsInit(options)
{
console.log(options);
  let save = {};

  for (let i in options)
  {
    if (prefs.data[i])
      prefs.data[i].value = options[i];
    else
      STORAGE.remove(i);

  }
  for (let i in prefs.data)
  {
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
          return this.data[i].value
        },
        set(val)
        {
          this(i, val)
        }
      });
    }catch(e){};
  }
  if (app.version != prefs.version)
  {
    save.version = app.version;
  }
  if (prefs.syncSettings && STORAGE !== chrome.storage.sync)
  {
    STORAGE = chrome.storage.sync;
    STORAGE.set({syncSettings: 1}, (res)=>{console.log(res)});
    return STORAGE.get(null, prefsInit);
  }
  else if (!prefs.syncSettings && STORAGE !== chrome.storage.local)
  {
    STORAGE.set({syncSettings: 0}, (res)=>{console.log(res)});
    STORAGE = chrome.storage.local;
    return STORAGE.get(null, prefsInit);
  }

  if (Object.keys(save).length)
    prefsSave(save, (er) => console.log("init prefs", save, er));

}; //prefsInit();

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

function createContextMenu()
{
  console.log("createContextMenu");
  if (prefs.contextMenu)
  {
    chrome.contextMenus.create(
    {
      title: "Last used TAB",
      id: "tabs+",
      type: "normal",
      contexts: ["all"]
    });
    chrome.contextMenus.onClicked.addListener(lastUsedTabSelect);
  }
  else
    chrome.contextMenus.removeAll();
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