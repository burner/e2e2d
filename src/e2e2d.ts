import {Browser, chromium, Page, ElementHandle} from "playwright";
import * as path from "path"
import { promises as fs } from "fs";
import { OptionDoc, OptionShort, parseCMD } from "lazyargs";

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
	selector: string = "";

	constructor(public U: E2E2D, public shouldTakeScreenshot: boolean = true) {
		this.msg = ["You"];
	}

	see(selector: string = "", docName: string = "") {
		this.selector = selector;
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

		this.msg.push(`'${toCmpAgainst}'`);
		if(v !== toCmpAgainst) {
			throw new E2E2DCompareError("Equals " + v + " " + toCmpAgainst, this
				, v, toCmpAgainst);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		await this.saveStep();
		return this;
	}

	async equal(toCmpAgainst: any, transform: (input: any) => any = identity): Promise<Should> {
		this.msg.push("equal");
		const v = Promise.resolve(this.el) == this.el
			? await transform(await this.el)
			: await transform(this.el);

		this.msg.push(`'${toCmpAgainst}'`);
		if(v !== toCmpAgainst) {
			throw new E2E2DCompareError("Equal " + v + " " + toCmpAgainst, this
				, v, toCmpAgainst);
		}
		this.U.printMsg(buildConsoleText(true, this.msg))
		await this.saveStep();
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
		await this.saveStep();
		return this;
	}

	async saveStep() {
		const step = new Step("should", this.selector, this.msg.join(" "));
		if(this.shouldTakeScreenshot && this.selector !== "") {
			await this.U.highlight(this.selector);
			step.afterHighlightScreenshot = await this.U.takeScreenshot(
				this.U.genFileName(this.msg.join("_"), "highlight"));
			await this.U.deHighlight();
		}
		this.U.recording.addStep(step);
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
	pw: E2E2DConfigPlaywrigth = new E2E2DConfigPlaywrigth();
	@OptionDoc("\n\t\tThe output folder for the documentation.")
	@OptionShort("o")
	outputFolder: string = outputFolderDefault;
	generateDoc: boolean = true;
}

function outputFolderName(outDir: string, testName: string) {
	const re = / /g;
	testName = testName.replace(re, "_");
	const folderName = path.join(outDir, "/", testName, "/");
	return folderName;
}

export class Step {
	beforeScreenshot: string = "";
	afterHighlightScreenshot: string = ""
	afterScreenshot: string = "";

	constructor(public action: string
			, public selector: string
			, public doc: string)
	{
	}
}

export class Recording {
	recodingIsOn: boolean = true;

	constructor(public steps: Step[] = []) {}

	addStep(step: Step) {
		if(this.recodingIsOn) {
			this.steps.push(step);
		}
	}
}

export class E2E2D {
	cnt: number = 0;
	constructor(public name: string, public desc: string
			, public conf: E2E2DConfig
			, public browser: Browser, public page: Page
			, public recording: Recording = new Recording()
	)
	{

	}

	stopRecording() {
		this.recording.recodingIsOn = false;
	}

	startRecording() {
		this.recording.recodingIsOn = false;
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

	genPrefix(): string {
		return outputFolderName(this.conf.outputFolder, this.name);
	}

	genFileName(action: string, part: string): string {
		return `${this.genPrefix()}${this.cnt}_${action}_${part}.png`;
	}

	async comment(doc: string) {
		const step = new Step("comment", "", doc);
		this.recording.addStep(step);
		++this.cnt;
	}

	async navTo(url: string, doc: string = "") {
		const step = new Step("navTo", "", doc);
		step.beforeScreenshot = await this.takeScreenshot(
			this.genFileName("navTo", "before"));
		try {
			await this.page.goto(url);
		} catch(e) {
			this.handleError(e, "navTo", `'${url}'`);
		}
		this.printMsg(`${greenTick}You navigate to ${url}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	async fill(selector: string, value: string, doc: string = "") {
		const step = new Step("insert", selector, doc);
		(<any>step)["value"] = value;
		try {
			step.beforeScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "before"));
			await this.highlight(selector);
			step.afterHighlightScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "highlight"));
			await this.page.fill(selector, value);
			step.afterScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "after"));
			await this.deHighlight();
		} catch(e) {
			this.handleError(e, "insert", `'${selector}' with '${value}'`);
		}
		this.printMsg(`${greenTick}You insert ${value} into ${selector}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	async leftClick(selector: string, doc: string = "") {
		const step = new Step("leftClick", selector, doc);
		step.beforeScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "before"));
		await this.highlight(selector);
		step.afterHighlightScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "highlight"));

		try {
			await this.highlight(selector);
			await this.page.click(selector);
			await this.deHighlight();
			step.afterScreenshot = await this.takeScreenshot(
				this.genFileName("leftClick", "after"));
		} catch(e) {
			this.handleError(e, "leftClick", `on '${selector}'`)
		}
		this.printMsg(`${greenTick}You left click ${selector}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	followStepsIn(name: string) {
		this.recording.addStep(new Step("followStepsIn", name, ""));
		++this.cnt;
	}

	async takeScreenshot(fn: string): Promise<string> {
		const prefix = this.genPrefix();
		if(this.recording.recodingIsOn) {
			await this.page.screenshot({path: fn});
		}
		return fn.slice(prefix.length);
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
		++this.cnt;
		return new Should(this);
	}

	shouldNoScreenShot() {
		++this.cnt;
		return new Should(this, false);
	}
}

async function makeOutputDir(outDir: string, testName: string) {
	await fs.mkdir(outputFolderName(outDir, testName), {recursive: true});
}

async function impl(name: string, desc: string): Promise<E2E2D> {
	const conf = parseArgs();

	await makeOutputDir(conf.outputFolder, name);

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
	constructor(public name: string, public fun: any
		, public recordSteps: boolean = false) {}
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
				if(!f.recordSteps) {
					chained.stopRecording();
				}
				chained = await f.fun(chained);
				if(!f.recordSteps) {
					chained.startRecording();
				}
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
				console.log("Error:" + e + e.stack);
			} else {
				console.log("Error Rest: " + e);
			}
			break;
		}
	}
	data.browser.close();
	await fs.writeFile(outputFolderName(chained.conf.outputFolder, name)
			+ "e2e2d.json", JSON.stringify(chained.recording, null, 2) + "\n");
	return data;
}
