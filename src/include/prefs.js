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