import {Browser, chromium, Page, ElementHandle} from "playwright";
import * as path from "path"
import { promises as fs } from "fs";
import { Elem, OptionCallback, OptionDoc, OptionShort, parseCMD, buildElem, enforce } from "lazyargs";

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
const tick = "\t\t✓ ";
const redCross = "\t\t\x1b[31m⨯\x1b[0m ";
const cross = "\t\t⨯ ";

function buildConsoleText(worked: boolean, color: boolean, rest: string[]) {
	let ret = worked
		? color ? greenTick : tick
		: color ? redCross : cross;
	return ret + rest.join(" ");
}

type ShouldFun = (sh: Should) => Promise<Should>;

export async function observe(sh: Should): Promise<Should> {
	sh.msg.push("observe");
	return sh;
}

export function that(thing: any): any {
	return async function(sh: Should): Promise<Should> {
		sh.msg.push("that");
		sh.el = thing;
		return sh;
	}
}

export async function is(sh: Should): Promise<Should> {
	sh.msg.push("is");
	return sh;
}

export function see(selector: string = "", docName: string = ""): any {
	return async function(sh: Should): Promise<Should> {
		sh.selector = selector;
		sh.msg.push("see");
		sh.msg.push(docName !== "" ? docName : selector);
		sh.el = await sh.U.page.waitForSelector(selector);
		return sh;
	}
}

export function equals(toCmpAgainst: any, transform: (input: any) => any = identity): any {
	return async function(sh: Should): Promise<Should> {
		const v = await transform(await sh.el);

		sh.msg.push(`'${toCmpAgainst}'`);
		if(v !== toCmpAgainst) {
			await sh.saveStepError(
				{ failed: "equals"
				, got: v
				, expected: toCmpAgainst
				});
			await sh.U.deHighlight(sh.selector, sh.shouldTakeScreenshot);
			throw new E2E2DCompareError("Equals " + v + " " + toCmpAgainst, sh
				, v, toCmpAgainst);
		}
		sh.U.printMsg(buildConsoleText(true, sh.U.conf.color, sh.msg))
		await sh.saveStep();
		return sh;
	}
}

export function equal(toCmpAgainst: any, transform: (input: any) => any = identity): any {
	return async function(sh: Should): Promise<Should> {
		const v = await transform(await sh.el);

		sh.msg.push(`'${toCmpAgainst}'`);
		if(v !== toCmpAgainst) {
			await sh.saveStepError(
				{ failed: "equal"
				, got: v
				, expected: toCmpAgainst
				});
			await sh.U.deHighlight(sh.selector, sh.shouldTakeScreenshot);
			throw new E2E2DCompareError("Equal " + v + " " + toCmpAgainst, sh
				, v, toCmpAgainst);
		}
		sh.U.printMsg(buildConsoleText(true, sh.U.conf.color, sh.msg))
		await sh.saveStep();
		return sh;
	}
}

export async function to(sh: Should): Promise<Should> {
	sh.msg.push("to");
	return sh;
}

export async function exist(sh: Should): Promise<Should> {
	const v = Promise.resolve(sh.el) == sh.el
		? await sh.el
		: sh.el;

	if(v === null || v === undefined) {
		await sh.saveStepError({ failed: "exist" });
		throw new E2E2DShouldError("Exist", sh);
	}
	sh.U.printMsg(buildConsoleText(true, sh.U.conf.color, sh.msg))
	await sh.saveStep();
	return sh;
}

export class Should {
	el: any;
	msg: string[];
	selector: string = "";

	constructor(public U: E2E2D, public shouldTakeScreenshot: boolean = true) {
		this.msg = ["You"];
	}

	async saveStepError(additionalData: any = null) {
		const step = new Step("should", this.selector, this.msg.join(" "));
		const stepAD = { ...step, ...additionalData };
		if(this.shouldTakeScreenshot) {
			stepAD.beforeScreenshot = await this.U.takeScreenshot(
				this.U.genFileName(this.msg.join("_"), "error"));
		}
		console.log(stepAD);
		this.U.recording.addStep(stepAD);
	}

	async saveStep(): Promise<any> {
		const step = new Step("should", this.selector, this.msg.join(" "));
		if(this.shouldTakeScreenshot && this.selector !== "") {
			await this.U.highlight(this.selector, this.shouldTakeScreenshot);
			step.afterHighlightScreenshot = await this.U.takeScreenshot(
				this.U.genFileName(this.msg.join("_"), "highlight"));
			await this.U.deHighlight(this.selector, this.shouldTakeScreenshot);
		}
		this.U.recording.addStep(step);
		return null;
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

function overWriteConfData(nesting: string[], key: string, options: any): void {
	const elem: Elem = buildElem(nesting, key, options);
	if(!elem.isEmpty()) {
		const s: string[] = elem.getNextString().split(":")
			.map((i: string) => i.trim());

		options.configFileData[s[0]] = s[1];
	}
}

export class E2E2DConfig {
	pw: E2E2DConfigPlaywrigth = new E2E2DConfigPlaywrigth();
	@OptionDoc("\n\t\tThe output folder for the documentation.")
	@OptionShort("o")
	outputFolder: string = outputFolderDefault;
	generateDoc: boolean = true;

	@OptionDoc("When true no message will be printed unless there is an error."
		+ " Then all so far emitted messages will be printed")
	silentUnlessError: boolean = false;

	color: boolean = true;
	configDataFilename: string = "";

	@OptionShort("c")
	@OptionCallback(overWriteConfData)
	configFileData: ConfigFileData = {};
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

export type ConfigFileData = { [key: string]: any };

export class E2E2D {
	cnt: number = 0;
	deferedOutput: string[] = [];
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
		this.recording.recodingIsOn = true;
	}

	printMsg(msg: string) {
		if(this.conf.silentUnlessError) {
			this.deferedOutput.push(msg);
		} else {
			console.log(msg);
		}
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
		this.printMsg(`${this.conf.color ? greenTick : tick}You navigate to ${url}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	async fill(selector: string, value: string, doc: string = "") {
		const step = new Step("insert", selector, doc);
		(<any>step)["value"] = value;
		try {
			step.beforeScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "before"));
			await this.highlight(selector, true);
			step.afterHighlightScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "highlight"));
			await this.page.fill(selector, value);
			step.afterScreenshot = await this.takeScreenshot(
				this.genFileName("insert", "after"));
			await this.deHighlight(selector, true);
		} catch(e) {
			this.handleError(e, "insert", `'${selector}' with '${value}'`);
		}
		this.printMsg(`${this.conf.color ? greenTick : tick}You insert '${value}' into ${selector}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	async leftClickNav(selector: string, doc: string = ""
			, afterClickScreenshot: boolean = true)
	{
		const step = new Step("leftClick", selector, doc);
		step.beforeScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "before"));
		await this.highlight(selector, true);
		step.afterHighlightScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "highlight"));
		await this.deHighlight(selector, true);

		try {
			await Promise.all(
				[ this.page.waitForNavigation({waitUntil: 'networkidle', timeout: 5000})
				, this.page.click(selector) ]
			);
			if(afterClickScreenshot) {
				step.afterScreenshot = await this.takeScreenshot(
					this.genFileName("leftClick", "after"));
			}
		} catch(e) {
			this.handleError(e, "leftClick", `on '${selector}'`)
		}
		this.printMsg(`${this.conf.color ? greenTick : tick}You left click ${selector}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	async leftClick(selector: string, doc: string = ""
			, afterClickScreenshot: boolean = true)
	{
		const step = new Step("leftClick", selector, doc);
		step.beforeScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "before"));
		await this.highlight(selector, true);
		step.afterHighlightScreenshot = await this.takeScreenshot(
			this.genFileName("leftClick", "highlight"));
		await this.deHighlight(selector, true);

		try {
			await this.page.click(selector);
			if(afterClickScreenshot) {
				step.afterScreenshot = await this.takeScreenshot(
					this.genFileName("leftClick", "after"));
			}
		} catch(e) {
			this.handleError(e, "leftClick", `on '${selector}'`)
		}
		this.printMsg(`${this.conf.color ? greenTick : tick}You left click ${selector}`);
		this.recording.addStep(step);
		++this.cnt;
	}

	followStepsIn(name: string) {
		this.recording.addStep(new Step("followStepsIn", name, ""));
		++this.cnt;
	}

	async takeScreenshot(fn: string): Promise<string> {
		const prefix = this.genPrefix();
		if(this.recording.recodingIsOn && this.conf.generateDoc) {
			await this.page.screenshot({path: fn});
		}
		return fn.slice(prefix.length);
	}

	async highlight(sel: string, shouldHighlight: boolean): Promise<any> {
		return shouldHighlight && sel !== null && sel !== undefined && sel != ""
			?  await this.page.evaluate(`Domlight(document.querySelector('${sel}'));`)
			: null;
	}

	async deHighlight(sel: string, shouldHighlight: boolean): Promise<any> {
		return shouldHighlight && sel !== null && sel !== undefined && sel != ""
			? await this.page.evaluate(`Domlight.hideAll();`)
			: null;
	}

	async should(funs: ShouldFun[]) {
		++this.cnt;
		return this.shouldImpl(new Should(this), funs);
	}

	async shouldNoScreenShot(funs: ShouldFun[]) {
		++this.cnt;
		return this.shouldImpl(new Should(this, false), funs);
	}

	private async shouldImpl(sh: Should, funs: ShouldFun[]): Promise<Should> {
		for(let fun of funs) {
			sh = await fun(sh);
		}
		return sh;
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
	if(conf.configDataFilename) {
		ret.conf.configFileData = JSON.parse(
			await fs.readFile(conf.configDataFilename, "utf8")
		);
	}

	return ret;
}

export class PreCondition {
	constructor(public name: string, public fun: any
		, public recordSteps: boolean = false) {}
}

export function preCondition(name: string, fun: any
		, recordSteps: boolean = false)
{
	return new PreCondition(name, fun, recordSteps);
}

export async function InOrderTo(name: string, desc: string
		, ...chain: any[]): Promise<any>
{
	const data: E2E2D = await impl(name, desc);
	let chained: E2E2D = data;

	data.printMsg("\tName: "+ name + "\n\tDesc: " + desc)

	for(const f of chain) {
		try {
			chained.startRecording();
			if(f.constructor.name == "AsyncFunction") {
				chained = await f(chained);
			} else {
				chained.followStepsIn(f.name);
				if(!f.recordSteps) {
					chained.stopRecording();
				}
				chained = await f.fun(chained);
			}
		} catch(e) {
			if(data.conf.silentUnlessError && data.deferedOutput.length > 0) {
				for(const line of data.deferedOutput) {
					console.log(line);
				}
			}
			if(e instanceof E2E2DCompareError) {
				console.log(buildConsoleText(false, data.conf.color,
					[ ...e.shld.msg, "|"
					,`Got: '${e.got}'`
					, `Expected: '${e.expected}'`
					]));
			} else if(e instanceof E2E2DShouldError) {
				console.log(buildConsoleText(false, data.conf.color
					, e.shld.msg));
			} else if(e instanceof Error) {
				console.log("Error: " + e + e.stack);
			} else {
				console.log("Error Rest: " + e);
			}
			if(data.conf.generateDoc) {
				await fs.writeFile(outputFolderName(chained.conf.outputFolder, name)
					+ "e2e2d.json", JSON.stringify(chained.recording, null, 2) + "\n");
			}
			process.exit(1);
		}
	}
	data.browser.close();
	if(data.conf.generateDoc) {
		await fs.writeFile(outputFolderName(chained.conf.outputFolder, name)
			+ "e2e2d.json", JSON.stringify(chained.recording, null, 2) + "\n");
	}
	return data;
}
