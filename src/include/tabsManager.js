class TabsManager
{
  constructor(data = new Map())
  {
    this.data = data;
    this.noChange = false;
    this.listeners = new Map();
    this.loaded = this.load();
    this.fields = {
      skip: true,
      id: false,
      index: false,
      url: true,
      windowId: false
    };
  }

  add(tab, save = true)
  {
    const tabOld = this.remove(tab, save) || {}; //move tab to the end of the list
    const newTab = this.update(tabOld, tab, true);
    this.data.set(newTab.id, newTab);
    debug.trace("TAB.add", {id: tab.id, tab, newTab, data: [...this.data.values()]});
    if (save)
      this.save();

    // setIcon(newTab);
    return newTab;
  }

  remove(tab, save = true)
  {
    const ret = this.data.get(tab.id);
    this.data.delete(tab.id);
    debug.trace("TAB.remove", {id: tab.id, tab, ret, data: [...this.data.values()]});
    if (save)
      this.save();

    return ret;
  }

  load()
  {
    return chrome.storage.session.get("tabsList");
  }
  save()
  {
    debug.trace("save", ""+[...this.data.keys()], [...this.data.values()]);
    return chrome.storage.session.set({tabsList:[...this.data.values()]});
  }

  find(tab)
  {
    return this.data.get(tab.id);
  }

  update(dataOld, dataNew, overwrite = false)
  {
    for(let i in this.fields)
    {
      if (i in dataNew && (this.fields[i] || (!this.fields[i] && overwrite)))
        dataOld[i] = dataNew[i];
    }
    return dataOld;
  }

  last(windowId, skip, skipIds)
  {
    skipIds = skipIds || [];
    let list = Array.from(this.data.values());
    for(let i = list.length - 1; i > -1; i--)
    {
      const tab = list[i];
      if (tab.windowId != windowId)
        continue;

      if ((!skip || (skip && !tab.skip)) && skipIds.indexOf(tab.id) == -1)
        return tab;
    }
    return null;
  }

  activate(tabId)
  {
    return chrome.tabs.update(tabId, {active: true}).catch(onError("TABS.activate"));
  }

  win(winId)
  {
    const winIds = (winId !== undefined && !(winId instanceof Array)) ? [winId] : winId;
    const r = {},
          tabs = Array.from(this.data.values());

    for (let i = 0; i < tabs.length; i++)
    {
      const tab = Object.assign({}, tabs[i]),
            windowId = tab.windowId;

      if (winId && winIds.indexOf(windowId) == -1)
        continue;

      if (!r[windowId])
        r[windowId] = [];

      delete tab.windowId;
      r[windowId].push(tab);
    }
    return JSON.stringify(r);
  }

  addListener(type, listener)
  {
    let list;
    if (!(list = this.listeners.get(type)))
    {
      list = new Map();
      this.listeners.set(type, list);
    }
    list.set(listener, type);
  }

  removeListener(type, listener)
  {
    const list = this.listeners.get(type);
    if (!list)
      return;

    list.delete(listener);
  }

  notifyListeners(type, ...args)
  {
    const list = this.listeners.get(type);
    if (!list || !list.size)
      return;

    for(let i = 0, listeners = [...list.keys()]; i < listeners.length; i++)
      listeners[i](...args);
  }
} // class TabsList
