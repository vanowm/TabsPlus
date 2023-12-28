debug.debug("options", performance.now());

const $ = id => document.getElementById(id);
const app = chrome.runtime.getManifest();
const Void = () => {};

if (!app.version_name)
	app.version_name = app.version;

template({app});

const init = ({ data: settings }) =>
{
	debug.debug("options init", performance.now());
	const elOptionsTable = document.querySelector("#options > .table");
	const elTemplate = elOptionsTable.firstElementChild;
	elOptionsTable.firstElementChild.remove();
	const elRestore = $("restore");
	const elReset = $("reset");
	const elRestoreFile = $("restoreFile");
	const elBackup = $("backup");
	const elHeader = $("header");
	const elOptWin = $("options_window");
	const elBackupRestore = $("backupRestore");
	const elOptions = $("options");
	const elExit = $("exit");
	const rectExit = elExit.getBoundingClientRect();
	// const port = chrome.runtime.connect(null, {name: "options"});
	// port.onMessage.addListener((message, _port) =>
	// {
	//   switch(message.type)
	//   {
	//     case "settingChanged":
	//       setOption(message.name, message.newValue, false);
	//       break;

	//   }
	// });
	const backup = async () =>
	{
		const d = new Date();
		const options = {
			suggestedName: `${app.name}_${_("settings")}_v${app.version}_`
				+ d.getFullYear()
				+ pad(d.getMonth() + 1)
				+ pad(d.getDate()) + "_"
				+ pad(d.getHours())
				+ pad(d.getMinutes())
				+ pad(d.getSeconds())
				+ ".json",
			types: [
				{
					description: app.name + _("settings"),
					accept: {
						"*/*": [".json"],
					},
				},
			],
			excludeAcceptAllOption: true,
			multiple: false
		};
		let fileHandle;
		try
		{
			fileHandle = await window.showSaveFilePicker(options);
		}
		catch { return; }

		const writable = await fileHandle.createWritable();
		await writable.write(JSON.stringify(getBackupData()));
		await writable.close();
	};
	const restore = data =>
	{
		const r = { restored: [], error: [] };
		for (const i in data)
		{
			const er = (!settings[i] && 1)
				+ (settings[i] && (typeof (settings.$default[i])) !== typeof (data[i]) ? 2 : 0)
				+ (settings[i] && settings.$options[i] && !settings.$options[i][data[i]] ? 4 : 0);
			//                 + (settings[i] && !settings[i].options ? 4 : 0)
			//                 + (i == "version" ? 4 : 0);
			if (er || i === "version" || settings.$internal[i])
			{
				// eslint-disable-next-line unicorn/no-array-reduce
				debug.debug("skipped", i, "value", data[i], "error code", er, er ? "(" + ["option doesn't exit", "wrong value type", "value out of range"].reduce((a, b, i) => (((er >> i) & 1) ? (a += (a ? ", " : "") + b) : a), "") + ")" : "");
				r.error[r.error.length] = i;
				continue;
			}

			setOption(i, data[i]);

			r.restored[r.restored.length] = i;
		}
		return r;
	};

	const reset = () =>
	{
		for (const o in settings)
		{
			if (settings[o].label)
			{
				settings[o].value = settings[o].default;
				setOption(o, settings[o].value, o !== "optWin");
			}
		}
		elOptWin.style.width = 0;
		elOptWin.style.height = 0;
		elOptWin.classList.remove("maximized");
		updatePos();
		savePos();
	};

	const onChange = evt =>
	{
		const option = evt.target;
		const value = ~~(option.type === "checkbox" ? option.checked : option.value);
		option.classList.toggle("default", value === settings[option.id].default);
		settings[option.id].value = value;
		let o = {};
		o[option.id] = value;
		if (onChange[settings[option.id].onChange] instanceof Function)
			onChange[settings[option.id].onChange](option.id, value);

		// eslint-disable-next-line sonarjs/no-small-switch
		switch (option.id)
		{
			case "syncSettings": {
				o = Object.assign(o, getBackupData());
				break;
			}

		}
		if (option.selectedOptions)
			option.title = option.selectedOptions[0].textContent;

		for (const i in o)
		{
			chrome.runtime.sendMessage(null,
				{
					type: "setting",
					name: i,
					value: o[i]
				}, Void);
		}
		backupRestore();
		enableDisable();
	};

	const enableDisable = () =>
	{
		const ids = {
			expandWindow:	settings.iconAction.value !== ACTION_LIST,
			showDate:		settings.iconAction.value !== ACTION_LIST,
			showUrl:		settings.iconAction.value !== ACTION_LIST,
			tabsScrollFix:	settings.newTabActivate.value !== 1,
			newTabPageOnly:	settings.newTabActivate.value !== 1,
			newTabPageSkip:	!settings.newTabActivate.value || settings.afterClose.value !== 1
		};
		for(const id in ids)
		{
			settings[id].input.disabled = ids[id];
			settings[id].input.closest(".row").classList.toggle("disabled", ids[id]);
		}
	};

	const setOption = (id, value, save) =>
	{
		const elOpt = $(id);
		if (!elOpt)
		{
			if (onChange[settings[id].onChange] instanceof Function)
				onChange[settings[id].onChange](id, value);

			if (save || save === undefined)
			{
				chrome.runtime.sendMessage(null,
					{
						type: "setting",
						name: id,
						value: value
					}, Void);
			}
			return;
		}
		let changed;
		if (elOpt.type === "checkbox")
		{
			changed = elOpt.checked !== value;
			elOpt.checked = value;
		}
		else
		{
			changed = elOpt.value !== value;
			elOpt.value = value;
		}
		if (changed)
			elOpt.dispatchEvent(new Event("input"));
	};

	const getBackupData = () =>
	{
		const o = {};
		for (const i in settings)
		{
			if (!settings[i].internal)
				o[i] = settings[i].value;
		}

		return o;
	};

	const backupRestore = isInit =>
	{
		const value = JSON.stringify(getBackupData());
		if (elBackupRestore.value !== value)
		{
			// debug.trace(init, JSON.stringify(getBackupData()));
			// when value changed, undo removed
			if (isInit)
				elBackupRestore.value = value;
			else
			{
				// add ability undo directly in the textarea when options changed
				const active = document.activeElement;
				elBackupRestore.focus();
				elBackupRestore.select();
				window.document.execCommand("insertText", false, value);
				active.focus();
			}
		}
		elBackupRestore.classList.remove("error");
		elRestore.disabled = true;
		elBackup.disabled = false;
	};

	/* window handler */
	const onMouseMove = evt =>
	{
		if (!win.move)
			return;

		if (elOptWin.classList.contains("maximized"))
		{
			const x = rectOptWin.x + win.offsetX; //get orig cursor position
			const y = rectOptWin.y + win.offsetY;

			if (x === evt.x && y === evt.y)
				return;

			const p = x * 100 / rectOptWin.width;
			elOptWin.style.top = 0;
			elOptWin.classList.remove("maximized");
			rectOptWin = elOptWin.getBoundingClientRect();
			const newX = p * rectOptWin.width / 100;
			elOptWin.style.left = newX + "px";
			rectOptWin = elOptWin.getBoundingClientRect();
			win.offsetX = x - newX - (x >= rectOptWin.right - rectExit.width ? x - (rectOptWin.right - rectExit.width - 2) : 0);
		}
		let x = Math.max(evt.x - win.offsetX, 0);
		let y = Math.max(evt.y - win.offsetY, 0);

		if (rectOptWin.width > win.rectBody.width)
		{
			elOptWin.style.width = win.rectBody.width + "px";
			rectOptWin.width = win.rectBody.width;
		}

		if (rectOptWin.height > win.rectBody.height)
		{
			elOptWin.style.height = win.rectBody.height + "px";
			rectOptWin.height = win.rectBody.height;
		}

		if (x + rectOptWin.width > win.rectBody.width)
			x = win.rectBody.width - rectOptWin.width;

		if (y + rectOptWin.height > win.rectBody.height)
			y = win.rectBody.height - rectOptWin.height;

		if (x === rectOptWin.x && y === rectOptWin.y)
			return;

		elOptWin.style.left = x + "px";
		elOptWin.style.top = y + "px";
		savePos();
	};

	const onMouseDown = evt =>
	{
		if (evt.target === elExit)// || elOptWin.classList.contains("maximized"))
			return;

		win.move = true;
		rectOptWin = elOptWin.getBoundingClientRect();
		win.rectBody = document.body.getBoundingClientRect();
		win.offsetX = evt.x - rectOptWin.x;
		win.offsetY = evt.y - rectOptWin.y;
		evt.stopPropagation();
	};

	const onMouseUp = () =>
	{
		win.move = false;
	};

	const savePos = () =>
	{
		win.rectBody = document.body.getBoundingClientRect();
		const position = [
			~~(elOptWin.style.left ? Number.parseFloat(elOptWin.style.left) : rectOptWin.left),
			~~(elOptWin.style.top ? Number.parseFloat(elOptWin.style.top) : rectOptWin.top),
			~~(elOptWin.style.width ? Number.parseFloat(elOptWin.style.width) : rectOptWin.width),
			~~(elOptWin.style.height ? Number.parseFloat(elOptWin.style.height) : rectOptWin.height),
			~~elOptWin.classList.contains("maximized")];

		const optWinPrevious = "" + settings.optWin.value;
		settings.optWin.value = position;

		if (!savePos.timer)
		{
			const time = 500;
			let i = -1;
			// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
			(function loop ()
			{
				if (!savePos.timer)
					savePos.timer = setInterval(loop, 100);

				if ("" + savePos.optWin === "" + settings.optWin.value)
				{
					clearInterval(savePos.timer);
					savePos.timer = null;
					savePos.optWin = null;
					i = time;
				}
				else
					savePos.optWin = settings.optWin.value;

				if (++i > time || !i)
				{
					i = 0;
					if ("" + settings.optWin.value !== "" + savePos.optWin && "" + settings.optWin.value !== optWinPrevious)
					{
						chrome.runtime.sendMessage(null,
							{
								type: "setting",
								name: "optWin",
								value: settings.optWin.value
							}, () =>
							{
								backupRestore();
							});
					}
					else
						backupRestore();

				}
			})();
		}
	};

	const updatePos = (position = settings.optWin.value) =>
	{
		if (!Array.isArray(position))
			position = [];

		rectOptWin = elOptWin.getBoundingClientRect();
		win.rectBody = document.body.getBoundingClientRect();
		elOptWin.style.left = (win.rectBody.width - rectOptWin.width) / 2 + "px";
		elOptWin.style.top = (win.rectBody.height - rectOptWin.height) / 2 + "px";
		// eslint-disable-next-line prefer-const
		let [winX, winY, winW, winH, winM] = position;
		winW = Math.max(~~winW, rectOptWin.width);
		winH = Math.max(~~winH, rectOptWin.height);
		elOptWin.style.left = Math.max(0, Math.min(win.rectBody.width - winW, winX)) + "px";
		elOptWin.style.top = Math.max(0, (winY + winH > win.rectBody.height ? win.rectBody.height - winH : winY)) + "px";
		elOptWin.style.width = winW + "px";
		elOptWin.style.height = winH + "px";
		elOptWin.classList.toggle("maximized", Boolean(winM));
	};

	const win = {
		heightDif: elOptWin.scrollHeight - elOptions.scrollHeight,
		textAreaDif: elOptWin.scrollHeight - elBackupRestore.scrollHeight,
		move: false,
	};

	let rectOptWin;
	for (const prefId in settings)
	{
		if (!settings[prefId].options)
			continue;

		const group = (settings[prefId].group && elOptionsTable.querySelector('[group="' + settings[prefId].group + '"]')) || elTemplate.cloneNode(false);
		const row = elTemplate.querySelector(".row").cloneNode(true);
		group.append(row);

		if (settings[prefId].group)
		{
			group.setAttribute("group", settings[prefId].group);
		}
		row.id = prefId + "Box";

		let value = settings[prefId].value;
		const isBool = settings[prefId].options.length === 2;
		const elOption = isBool ? document.createElement("input") : row.querySelector("select");

		if (value === undefined || value < 0 || value > settings[prefId].options.length)
			value = settings[prefId].default;

		if (isBool)
		{
			elOption.checked = value ? true : false;
			elOption.type = "checkbox";
			const elSelect = row.querySelector("select");
			elSelect.parentNode.replaceChild(elOption, elSelect);
			row.classList.add("checkbox");
		}
		else
		{
			row.classList.add("select");
			debug.debug(settings);
			for (let i = 0, elOptTemplate = document.createElement("option"); i < settings[prefId].options.length; i++)
			{
				const elOpt = elOptTemplate.cloneNode(true);
				elOpt.value = settings[prefId].options[i].id;
				elOpt.textContent = settings[prefId].options[i].name;
				if (settings[prefId].options[i].description)
					elOpt.title = settings[prefId].options[i].description;

				const defaultValue = settings[prefId].map ? settings[prefId].map.indexOf(settings[prefId].default) : settings[prefId].default;
				if (defaultValue === i)
					elOpt.className = "default";

				elOption.append(elOpt);
			}
			elOption.value = value;
			elOption.classList.toggle("default", value === settings[prefId].default);
		}
		settings[prefId].input = elOption;
		elOption.addEventListener("input", onChange);
		elOption.id = prefId;
		if (elOption.selectedOptions)
			elOption.title = elOption.selectedOptions[0].textContent;

		if (settings[prefId].description)
		{
			row.title = settings[prefId].description;
		}
		row.querySelector(".label").textContent = settings[prefId].label;
		elOptionsTable.append(group);
		row.addEventListener("click", evt =>
		{
			if (isBool)
			{
				if (evt.target.classList.contains("label"))
				{
					elOption.focus();
					elOption.click();
				}
			}
			else
			{
				elOption.focus();
			}
		});
		if (onChange[settings[prefId].onChange] instanceof Function)
			onChange[settings[prefId].onChange](prefId, value);

	}//for(o in settings)

	window.addEventListener("keydown", evt =>
	{
		if (evt.key === "s" && evt.ctrlKey && !evt.altKey)
		{
			evt.preventDefault();
			backup();
		}
	});

	elBackupRestore.addEventListener("input", evt =>
	{
		debug.debug(evt);
		let data = {};
		let error = false;
		const value = elBackupRestore.value.trim();
		try
		{
			data = JSON.parse(value);
		}
		catch
		{
			error = true;
		}
		const o = getBackupData();
		let changed = false;

		for (const i in o)
		{
			if (i in data && o[i] !== data[i])
			{
				changed = true;
				break;
			}
		}
		evt.target.classList.toggle("error", value !== "" && error);
		elRestore.disabled = error || !changed || Object.keys(data).length === 0;
		elBackup.disabled = value !== "" && error;
	});

	elRestore.addEventListener("click", () =>
	{
		let data = {};
		try
		{
			data = JSON.parse(elBackupRestore.value.trim());
		}
		catch {}
		debug.debug(restore(data));
		backupRestore();
	});

	elReset.addEventListener("click", reset);
	elRestoreFile.addEventListener("click", async () =>
	{
		const options = {
			types: [{
				description: app.name + " " + _("settings"),
				accept: {
					"text/json": [".json"]
				},
			}],
			excludeAcceptAllOption: true,
			multiple: false
		};
		let fileHandle;
		try
		{
			[fileHandle] = await window.showOpenFilePicker(options);
		}
		catch { return; }
		const file = await fileHandle.getFile();
		const contents = await file.text();

		let data = {};
		try
		{
			data = JSON.parse(contents);
		}
		catch {}
		debug.debug(restore(data));
		backupRestore();
	});

	elBackup.addEventListener("click", backup);

	elOptWin.style.minHeight = elOptions.scrollHeight + win.heightDif + "px";

	updatePos();
	new ResizeObserver(() =>
	{
		if (elOptWin.style.height !== "")
			elOptWin.classList.add("resized");

		savePos();
	}).observe(elOptWin);

	elHeader.addEventListener("mousedown", onMouseDown);
	elHeader.addEventListener("dblclick", () => elOptWin.classList.toggle("maximized"));
	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);
	/* window handler end */

	elExit.addEventListener("click", () => window.close());
	backupRestore(true);
	enableDisable();
	document.body.classList.remove("hide");
	debug.debug("performance", performance.now());
};//init()

chrome.runtime.sendMessage(null, { type: "settings" })
	.then(init)
	.catch(error => debug.trace("options", error, chrome.runtime.onError));
