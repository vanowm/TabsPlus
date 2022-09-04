class TabsManager
{
  constructor(data = new Map())
  {
    this.data = data;
    this.noChange = false;
    this.listeners = new Map();
  }

  add(tab)
  {
    const that = this;
    const callback = (tab) =>
    {
debug.log(that, tab);
      let data = that.data.get(tab.windowId);
      if (!data)
      {
        data = new Map();
        that.data.set(tab.windowId, data);
      }
      const existedTab = that.remove(tab, true); //move tab to the end of the list
      data.set(tab.id, existedTab || tab);
      if (existedTab)
        that.update(tab, existedTab);
    };
    if (typeof(tab) == "number")
      chrome.tabs.get(tab, callback);
    else
      callback(tab);
  }

  remove(tab, noCheck)
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
  }

  find(id, windowId)
  {
    const data = windowId ? [this.data.get(windowId)] : Array.from(this.data.values());
    if (!data)
      return;

debug.log(data);
    for(let i = 0, tab; i < data.length; i++)
    {
      if (!data[i])
        continue;

      tab = data[i].get(id);
      if (tab)
        return tab;
    }
  }

  update(tab, oldTab)
  {
    const data = this.data.get(tab.windowId);
    if (!data)
      return;

// debug.log("update orig", tab, oldTab);
    if (!oldTab)
      oldTab = data.get(tab.id)||{};

// const _t = Object.assign({}, oldTab);
// debug.log("update", {tab, oldTab, data, _t});
    for(let i in tab)
    {
// debug.log("tab changed", oldTab[i] !== tab[i], i, tab[i], oldTab[i]);
// if (oldTab[i] !== tab[i]) debug.log("tab changed", i, tab[i], oldTab[i]);
      oldTab[i] = tab[i];
    }
    for(let i in oldTab)
    {
// debug.log("tab changed", oldTab[i] !== tab[i], i, tab[i], oldTab[i]);
// if (oldTab[i] !== tab[i]) debug.log("tab changed", i, tab[i], oldTab[i]);
      tab[i] = oldTab[i];
    }

// debug.log("tabs update", _t, data.get(tab.id));
  }

  last(windowId, skipAfterClose, skipIds)
  {
    skipIds = skipIds || [];
    let data;
    if (windowId)
      data = this.data.get(windowId) ? this.data.get(windowId).values() : [];
    else
      data = Array.from(this.data.values()).pop().values();

    data = Array.from(data);
    for(let i = data.length - 1; i >= 0; i--)
    {
      const tab = data[i];
debug.log(tab.id);
      if ((!skipAfterClose || (skipAfterClose && !tab.skipAfterClose)) && skipIds.indexOf(tab.id) == -1)
        return tab;
    }
  }

  activate(tabId)
  {
    return chrome.tabs.update(tabId, {active: true}).catch(onError("TABS.activate"));
  }

  win(win)
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