import {Browser, chromium, Page, ElementHandle} from "playwright";

const OptionMetaDataStore: string = "lazyArgs";

class LazyArg {
	constructor(public propName: string, public shortName: string = "", public doc: string = "") {}
}

function getLazyArg(target: Object, propertyKey: string): LazyArg {
	let pro: Object = Object.prototype;
	if(!pro.hasOwnProperty(OptionMetaDataStore)) {
		(pro as any)[OptionMetaDataStore] = {};
	}

	if(!(pro as any)[OptionMetaDataStore].hasOwnProperty(propertyKey)) {
		(pro as any)[OptionMetaDataStore][propertyKey] =
			new LazyArg(propertyKey);
	}

	return (pro as any)[OptionMetaDataStore][propertyKey];
}

const OptionShort = (shortName: string) => (target: Object, propertyKey: string) => {
	let lazyArg: LazyArg = getLazyArg(target, propertyKey);

	lazyArg.shortName = shortName;
};

const OptionDoc = (doc: string) => (target: Object, propertyKey: string) => {
	let lazyArg: LazyArg = getLazyArg(target, propertyKey);

	lazyArg.doc = doc;
};

function getShortName<T extends Object>(obj: T, propName: string): string {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	return lazyArg.shortName == ""
		? ""
		: "-" + lazyArg.shortName;
}

function buildDocString<T extends Object>(obj: T, propName: string): string {
	const lazyArg: LazyArg = getLazyArg(obj, propName);
	const prefix = `Type: ${typeof (<any>obj)[propName]}, Default: ${(<any>obj)[propName]}`;
	return lazyArg.doc == ""
		? prefix
		: prefix + " " + lazyArg.doc;
}

function enforce(cond: boolean, msg: string) {
	if(!cond) {
		throw new Error(msg);
	}
}

class Elem {
	public idx: number = -1;
	public name: string = "";
	constructor(public lName: string, public lIdx: number
		, public sName: string, public sIdx: number)
	{
		enforce(this.lIdx === -1 || this.sIdx === -1,
			`Found both '${this.lName}' at ${this.lIdx}`
			+ ` and '${this.sName}' at ${this.sIdx} in ${process.argv.join(", ")}`);

		const { i, n } =
			this.lIdx !== -1
				? {i: this.lIdx, n: this.lName}
				: this.sIdx !== -1
					? {i: this.sIdx, n: this.sName}
					: {i: -1, n: ""};

		this.idx = i;
		this.name = n;
	}

	isEmpty(): boolean {
		return this.idx == -1;
	}

	nextExist(): boolean {
		return this.idx + 1 < process.argv.length;
	}

	nextIsBoolean(): boolean {
		return this.nextExist()
			&& (process.argv[this.idx + 1] === "true"
				|| process.argv[this.idx + 1] === "false");
	}

	getNextBoolean(): boolean {
		return process.argv[this.idx + 1] === "true";
	}

	getNextNumber(): number {
		enforce(this.nextExist(), `To get a number from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return parseInt(process.argv[this.idx + 1], 10);
	}

	getNextString(): string {
		enforce(this.nextExist(), `To get a string from '${this.name}' at `
			+ `${this.idx} the next element must exist`);
		return process.argv[this.idx + 1];
	}

	remove(howMany: 1 | 2) {
		process.argv.splice(this.idx, howMany);
	}
}

function fillUpConfig<T extends Object>(resultObject: T, nesting: string[]) {
	for(const key of Object.getOwnPropertyNames(resultObject)) {
		let thing = (<any>resultObject)[key];
		if(typeof thing === "object") {
			fillUpConfig(thing, [...nesting, key]);
		} else {
			const lName = `--${[...nesting, key].join(".")}`;
			const lIdx = process.argv.indexOf(lName);
			const sName = getShortName(resultObject, key);
			const sIdx = sName !== "" ? process.argv.indexOf(sName) : -1

			const elem = new Elem(lName, lIdx, sName, sIdx);
			if(elem.isEmpty()) {
				continue;
			}

			if(typeof thing  === "boolean" && elem.nextIsBoolean()) {
				(<any>resultObject)[key] = elem.getNextBoolean();
				elem.remove(2);
			} else if(typeof thing  === "boolean") {
				(<any>resultObject)[key] = true;
				elem.remove(1);
			} else if(typeof thing  === "number") {
				(<any>resultObject)[key] = elem.getNextNumber();
				elem.remove(2);
			} else if(typeof thing  === "string") {
				(<any>resultObject)[key] = elem.getNextString();
				elem.remove(2);
			}
		}
	}
}

function printHelp<T extends Object>(options: T, nesting: string[]) {
	for(const key of Object.getOwnPropertyNames(options)) {
		let thing = (<any>options)[key];
		if(typeof thing === "object") {
			printHelp(thing, [...nesting, key]);
		} else {
			const sn = getShortName(options, key);
			console.log("\t" + `${sn != "" ? "-" + sn + " " : ""}--${[...nesting, key].join(".")}`
				+ ` ${buildDocString(options, key)}`);
		}
	}
}

function parseCMDargs<T extends Object>(options: T): T {
	fillUpConfig(options, []);
	return options;
}

function parseCMD<T extends Object>(options: T, header: string): T {
	if(process.argv.indexOf("--help") !== - 1
			|| process.argv.indexOf("-h") !== -1)
	{
		console.log(header);
		printHelp(options, []);
		process.exit(0);
	} else {
		return parseCMDargs(options);
	}
}

export async function identity(input: any): Promise<any> {
	return input;
}

export async function innerText(el: ElementHandle): Promise<any> {
	return el !== null && el !== undefined
		? await el.innerText()
		: "";
}

export class E2E2DError extends Error {
	constructor(msg: string, dontRegister: boolean = true) {
		super(msg);
		if(dontRegister) {
			Object.setPrototypeOf(this, E2E2DError.prototype);
		}
	}
}

export class E2E2DShouldError extends E2E2DError {
	constructor(msg: string, public shld: Should, dontRegister: boolean = true)
	{
		super(msg, false);
		if(dontRegister) {
			Object.setPrototypeOf(this, E2E2DShouldError.prototype);
		}
	}
}

export class E2E2DCompareError extends E2E2DShouldError {
	constructor(msg: string, public shld: Should
		, public got: any, public expected: any
		, dontRegister: boolean = true)
	{
		super(msg, shld, false);
		if(dontRegister) {
			Object.setPrototypeOf(this, E2E2DCompareError.prototype);
		}
	}
}

const greenTick = "\t\t\x1b[32m✓\x1b[0m ";
const redCross = "\t\t\x1b[31m⨯\x1b[0m ";

function buildConsoleText(worked: boolean, rest: string[]) {
	let ret = worked ? greenTick : redCross;
	return ret + rest.join(" ");
}

export class Should {
	el: any;
	msg: string[];

	constructor(public U: E2E2D) {
		this.msg = ["You"];
	}

	see(selector: string = "", docName: string = "") {
		this.msg.push("see");
		this.msg.push(docName !== "" ? docName : selector);
		try {
			this.el = this.U.page.$(selector);
		} catch(e) {
			console.log(e);
		}
		return this;
	}

	get observe(): Should {
		this.msg.push("observe");
		return this;
	}

	that(thing: any): Should {
		this.msg.push("that");
		this.el = thing;
		return this;
	}

	get is(): Should {
		this.msg.push("is");
		return this;
	}

	async equals(toCmpAgainst: any, transform: (input: any) => any = identity): Promise<Should> {
		this.msg.push("equals");
		const v = Promise.resolve(this.el) == this.el
			? await transform(await this.el)
			: await transform(this.el);

		if(v !== toCmpAgainst) {
			throw new E2E2DCompareError("Equals " + v + " " + toCmpAgainst, this
				, v, toCmpAgainst);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}

	async equal(toCmpAgainst: any, transform: (input: any) => any = identity): Promise<Should> {
		this.msg.push("equal");
		const v = Promise.resolve(this.el) == this.el
			? await transform(await this.el)
			: await transform(this.el);

		if(v !== toCmpAgainst) {
			throw new E2E2DCompareError("Equal " + v + " " + toCmpAgainst, this
				, v, toCmpAgainst);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}

	get to(): Should {
		this.msg.push("to");
		return this;
	}

	async exist(): Promise<Should> {
		this.msg.push("exist");
		const v = Promise.resolve(this.el) == this.el
			? await this.el
			: this.el;
		if(v === null || v === undefined) {
			throw new E2E2DShouldError("Exist", this);
		}
		v.setAttribute('style', 'background-color=red;');
		this.U.printMsg(buildConsoleText(true, this.msg))
		return this;
	}
}

function parseArgs(): E2E2DConfig {
	let options = new E2E2DConfig();
	return parseCMD(options, "End to End to Documentation");
}

export class E2E2DConfigPlaywrigth {
	headless: boolean = false;
	@OptionShort("s")
	slowMo: number = 300;
	screenX: number = 1920;
	screenY: number = 1080;
	devTools: boolean = false;
}

const outputFolderDefault = "e2e2documentation"

export class E2E2DConfig {
	@OptionDoc("\n\t\tThe output folder for the documentation.")
	@OptionShort("o")
	outputFolder: string = outputFolderDefault;
	pw: E2E2DConfigPlaywrigth = new E2E2DConfigPlaywrigth();
}

export class E2E2D {
	constructor(public name: string, public desc: string
			, public conf: E2E2DConfig
			, public browser: Browser, public page: Page)
	{
	}

	printMsg(msg: string) {
		console.log(msg);
	}

	handleError(e: Error, fun: string, msg: string = "") {
		this.printMsg("\t\t" + `You ${fun}${msg !== "" ? " " + msg : ""} failed`);
		this.printMsg("\t\t\twith error");
		this.printMsg(e.message);
		throw e;
	}

	async navTo(url: string) {
		try {
			await this.page.goto(url);
		} catch(e) {
			this.handleError(e, "navTo", `'${url}'`);
		}
		this.printMsg(`${greenTick}You navigate to ${url}`);
	}

	async fill(selector: string, value: string) {
		try {
			await this.page.fill(selector, value);
		} catch(e) {
			this.handleError(e, "fill", `'${selector}' with '${value}'`);
		}
		this.printMsg(`${greenTick}You insert ${value} into ${selector}`);
	}

	async leftClick(selector: string) {
		try {
			await this.highlight(selector);
			await this.page.click(selector);
			await this.deHighlight();
		} catch(e) {
			this.handleError(e, "leftClick", `on '${selector}'`)
		}
		this.printMsg(`${greenTick}You left click ${selector}`);
	}

	followStepsIn(name: string) {
	}

	async highlight(sel: string) {
		await this.page.evaluate(
`if(typeof Domlight === "function") {
	Domlight(document.querySelector('${sel}'));
}`);
	}

	async deHighlight() {
		await this.page.evaluate(
`if(typeof Domlight === "function") {
	Domlight.hideAll();
}`);
	}

	get should() {
		return new Should(this);
	}
}

async function impl(name: string, desc: string): Promise<E2E2D> {
	const conf = parseArgs();
	const browser = await chromium.launch(
		{ headless: conf.pw.headless
		, slowMo: conf.pw.slowMo
		, devtools: conf.pw.devTools
		});
	const page = await browser.newPage();
	let ret = new E2E2D(name, desc, conf, browser, page);
	return ret;
}

export class PreCondition {
	constructor(public name: string, public fun: any) {}
}

export function preCondition(name: string, fun: any) {
	return new PreCondition(name, fun);
}

export async function InOrderTo(name: string, desc: string
		, ...chain: any[]): Promise<any>
{
	const data: E2E2D = await impl(name, desc);
	let chained: E2E2D = data;

	console.log("\tName: "+ name + "\n\tDesc: " + desc);

	for(const f of chain) {
		try {
			if(f.constructor.name == "AsyncFunction") {
				chained = await f(chained);
			} else {
				chained.followStepsIn(f.name);
				chained = await f.fun(chained);
			}
		} catch(e) {
			if(e instanceof E2E2DCompareError) {
				console.log(buildConsoleText(false,
					[ ...e.shld.msg, "|"
					,`Got: '${e.got}'`
					, `Expected: '${e.expected}'`
					]));
			} else if(e instanceof E2E2DShouldError) {
				console.log(buildConsoleText(false, e.shld.msg));
			} else if(e instanceof Error) {
				console.log("Error:" + e);
			} else {
				console.log("Error Rest: " + e);
			}
			break;
		}
	}
	data.browser.close();
	return data;
}
