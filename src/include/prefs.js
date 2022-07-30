
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
        valid: [0, ACTION_UNDO, ACTION_MARK, ACTION_LIST]
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

    chrome.runtime.sendMessage(null,
    {
      type: "prefChanged",
      name: o,
      newValue: changes[o].newValue,
      oldValue: changes[o].oldValue
    }, resp => debug.log(o, resp, chrome.runtime.lastError));
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
    }catch(er){}
  }




debug.log(JSON.stringify(prefs.data, null, 2), type);
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

debug.log(JSON.stringify(prefs.data, null, 2),save, type);
  if (Object.keys(save).length)
    prefsSave(save, er => debug.log("init prefs", save, er));

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

STORAGE.get(null, prefsInit);

// storage change listener
chrome.storage.onChanged.addListener( prefsOnChanged );
