/**
 * A function that sets an alarm using Chrome's alarms API as a backup plan in case the extension was suspended.
 * @function
 * @returns {Promise} A promise that resolves when the alarm is executed.
 */
const setAlarm = (() =>
{
	//using alarms as a backup plan in case extension was suspended
	const list = new Map();
	const listener = alarm =>
	{
	// if (list.get(alarm.name).timer)
	//   debug.log("alarm", alarm.name, new Date().toISOString(), new Date(alarm.scheduledTime).toISOString(), alarm);
		alarmHandler.exec(alarm.name);
	};

	/**
	 * A function that returns a time string HH:MM:SS.mmm
	 * @function
	 * @param {Date} d - The date object to convert to a string.
	 * @param {boolean} [ms=true] - Whether to include milliseconds in the string.
	 * @returns {string} A string representation of the date object.
	 */
	const timeString = (d, ms = true) => (d > 3_600_000 ? pad(d.getHours()) + ":" : "") + (d > 60_000 ? pad(d.getMinutes()) + ":" : "") + pad(d.getSeconds()) + (ms ? "." + pad(d.getMilliseconds(),3) : "");

	/**
	 * A function that handles setting an alarm.
	 * @function
	 * @param {Function} callback - The function to execute when the alarm is triggered.
	 * @param {number} time - The time in milliseconds to wait before triggering the alarm.
	 * @param {string} [name=function_.toString()] - The name of the alarm.
	 * @param {boolean} [clear=true] - Whether to clear any existing alarms with the same name.
	 * @returns {Promise} A promise that resolves when the alarm is executed.
	 */
	const alarmHandler = (callback, time, name, clear = true) =>
	{
		if (name === undefined)
			name = callback.toString();

		const when = Date.now() + time;
		// debug.log("alarm set", name, new Date().toISOString(), new Date(when).toISOString());
		let alarm = list.get(name);
		if (!alarm)
		{
			alarm = {name};
			alarm.promise = new Promise(resolve =>
			{
				alarm.resolve = resolve;
			});
		}
		alarm.func = callback;
		alarm.time = time;
		alarm.when = timeString(new Date(when));

		list.set(name, alarm);
		if (clear)
		{
			chrome.alarms.clear(name);
			clearTimeout(alarm.timer);
		}
		alarm.timer = setTimeout(() => listener({name, scheduledTime: when}), time);
		chrome.alarms.create(name, {when});
		debug.trace("alarm added", alarm);
		return alarm.promise;
	};

	/**
	 * An object that contains methods for deleting and executing alarms.
	 * @namespace
	 */
	Object.assign(alarmHandler, {
		/**
		 * A method that deletes an alarm by name or function.
		 * @function
		 * @param {string|Function} name - The name or function of the alarm to delete.
		 */
		delete: name =>
		{
			if (name instanceof Function)
				name = name.toString();

			chrome.alarms.clear(name);
			list.delete(name);
		},

		/**
		 * A method that executes an alarm by name.
		 * @function
		 * @param {string} name - The name of the alarm to execute.
		 */
		exec: name =>
		{
			const alarm = list.get(name);
			debug.debug("alarm.exec", {name, timer: Boolean(alarm?.timer), alarm});
			if (!alarm)
				return;

			chrome.alarms.clear(name);
			clearTimeout(alarm.timer);
			if (alarm.timer)
				alarm.resolve(alarm.func instanceof Function && alarm.func());

			delete alarm.timer;
		}
	});
	chrome.alarms.onAlarm.addListener(listener);
	return alarmHandler;
})();