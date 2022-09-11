let STORAGE = chrome.storage.sync;
const prefs = function(name, value)
{
  if (value === undefined)
    return prefs[name];

  if (prefs[name] === undefined)
    return;

  const save = prefs[name];
  prefs.data[name].value = value;
  if (save !== value)
  {
    const o = {};
    o[name] = value;
    prefsSave(o, er => debug.log("prefsSave", o, er, chrome.runtime.lastError));
  }
  return save;
};

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
        default: 1,
      },
      afterClose:
      {
        default: 1,
      },
      iconAction:
      {
        default: ACTION_LIST,
        onChange: "iconActionChanged",
        group: "iconAction",
        map: [0, ACTION_LIST, ACTION_UNDO, ACTION_SKIP, ACTION_UNLOAD_TAB, ACTION_UNLOAD_WINDOW, ACTION_UNLOAD_ALL],
        valid: [0, ACTION_UNDO, ACTION_SKIP, ACTION_LIST, ACTION_UNLOAD_TAB, ACTION_UNLOAD_WINDOW, ACTION_UNLOAD_ALL]
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
        default: []
      },
      version:
      {
        noSync: true,
        default: ""
      }
    }
  }
});


function prefsOnChanged(changes, area)
{
debug.log("prefsOnChanged", arguments);
  if (area == "sync" && STORAGE !== chrome.storage.sync)
    return;

  for (let o in changes)
  {
    if (!prefs.data[o])
      continue;

    if (onChange[prefs.data[o].onChange] instanceof Function)
      onChange[prefs.data[o].onChange](o, changes[o].newValue, changes[o].oldValue);

    messenger({
      type: "prefChanged",
      name: o,
      newValue: changes[o].newValue,
      oldValue: changes[o].oldValue
    });
  }
}

function prefsSave(o, callback)
{
debug.log(STORAGE === chrome.storage.local, o);
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
debug.log("local", local);
debug.log("sync", sync);
  if (Object.keys(local).length)
    chrome.storage.local.set(local, callback);

  if (Object.keys(sync).length)
    chrome.storage.sync.set(sync, callback);
}

let prefsInited = new Promise((resolve, reject) =>
{
  //options

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
            valid[valid.length] = n;

          n++;
        }
        while(d);
      }
      const map = prefs.data[i].map;
      for(let n = 0; n < valid.length; n++)
      {
        d = chrome.i18n.getMessage(i + "_" + n);
        if (!d)
          continue;

        if (!prefs.data[i].options)
          prefs.data[i].options = [];

        const index = map ? map.indexOf(n) : n;
        prefs.data[i].options[index] = {id: n, name: d, description: chrome.i18n.getMessage(i + "_" + n + "_desc")};
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
        const n = i;
        Object.defineProperty(prefs, i,
        {
          enumerable: true,
          configurable: false,
          get()
          {
            return this.data[n].value;
          },
          set(val)
          {
            this(n, val);
          }
        });
      }catch(er){}
    }




  // debug.log(JSON.stringify(prefs.data, null, 2), type);
  //alert("startup prefs with sync off are overwritten by sync.");

    if (type === undefined && prefs.syncSettings && STORAGE !== chrome.storage.sync)
    {
      STORAGE = chrome.storage.sync;
      chrome.storage.local.set({syncSettings: 1}, res=>res&&debug.log(res));
      return STORAGE.get(null, e => prefsInit(e, "sync"));
    }
    else if (type === undefined && !prefs.syncSettings && STORAGE !== chrome.storage.local)
    {
      chrome.storage.local.set({syncSettings: 0}, res=>res&&debug.log(res));
      STORAGE = chrome.storage.local;
      return STORAGE.get(null, e => prefsInit(e, "local"));
    }
  debug.log(type, local, options);

    if (local.length)
    {
      chrome.storage.local.get(local, e => prefsInit(e, "local"));
      return;
    }
    if (app.version != prefs.version)
    {
      save.version = app.version;
    }

  // debug.log(JSON.stringify(prefs.data, null, 2),save, type);
    if (Object.keys(save).length)
      prefsSave(save, er => debug.log("init prefs", save, er));

    // context menu
    onChange.createContextMenu();
    const allTabs = chrome.tabs.query({});
    const aTabs = chrome.tabs.query({active: true});
    const currentTab = chrome.tabs.query({active: true, currentWindow: true});
    TABS.loaded.then(async list =>
    {
      list = list.tabsList || [];
      const activeTabs = await aTabs;
      const tabs = await allTabs;
      debug.log(list, tabs);
      // const uuid = new Map();
      for(let i = 0; i < tabs.length; i++)
      {
        const tab = TABS.add(tabs[i], false);
        // uuid.set(tab.uuid, tab);
      }
      for(let i = 0; i < list.length; i++)
      {
        let tab = list[i];
        // if (uuid.has(tab.uuid))
        //   tab.id = uuid.get(tab.uuid).id;

        const data = TABS.data.get(tab.id);

        if (data)
          tab = TABS.update(data, tab);

        // TABS.add(tab, false);

        // const opened = messengerHandler.onConnect.tab && messengerHandler.onConnect.tab.id === tab.id;
        // setIcon(tab, opened);
      }
      for(let i = 0; i < activeTabs.length; i++)
        TABS.add(activeTabs[i], false);

      TABS.save();
      TABS.data.forEach(tab => setIcon(tab));
      resolve();
      const [tab] = await currentTab;
      setContext(tab);
    });
  } //prefsInit();

  STORAGE.get(null, prefsInit);

  // storage change listener
  chrome.storage.onChanged.addListener( prefsOnChanged );
});
