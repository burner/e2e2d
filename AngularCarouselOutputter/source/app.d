import std.algorithm.iteration : map;
import std.range : tee;
import std.array;
import std.stdio;
import std.format;
import std.json;
import std.path;
import std.string;
import std.file;
import args;

struct Options {
	@Arg()
	string inputFolder = "e2e2documentation";
	@Arg()
	string outputFolder;
}

private Options __theOptions;

ref const(Options) options() {
	return __theOptions;
}

ref Options writeableOptions() {
	return __theOptions;
}


struct Step {
	string action;
	string selector;
	string doc;
	string beforeScreenshot;
	string afterHighlightScreenshot;
	string afterScreenshot;
}

struct E2E2D {
	string folderName;
	string title;
	JSONValue jv;

	Step[] steps;
}

string get(JSONValue jv, string key) {
	return key in jv
		? jv[key].get!string()
		: "";
}

E2E2D parseJV(E2E2D input) {
	input.title = input.jv["name"].get!string();
	foreach(key, JSONValue value; input.jv["steps"].arrayNoRef()) {
		Step e;
		foreach(mem; __traits(allMembers, Step)) {
			__traits(getMember, e, mem) = get(value, mem);
		}
		input.steps ~= e;
	}
	return input;
}

E2E2D fromFileName(string fn) {
	E2E2D ret;
	try {
		ret.folderName = dirName(fn);
		ret.jv = parseJSON(readText(fn));
	} catch(Exception e) {
		writefln("failed to parse json for file '%s'", fn);
		writeln(e.toString());
		throw e;
	}
	return ret;
}

void writeDocs(Out)(ref Out o, E2E2D[] docs) {
	formattedWrite(o, "mat-accordion\n");
	foreach(it; docs) {
		formattedWrite(o, "\tmat-expansion-panel\n\t\tmat-expansion-panel-header\n"
			~ "\t\t\tmat-panel-title %s\n\t\tmat-dialog-content\n"
			, it.title);
		writeDoc(o, it);
	}
}

void writeDoc(Out)(ref Out o, E2E2D doc) {
	formattedWrite(o,
`			mat-carousel(
				timings="250ms ease-in"
				"[autoplay]"="true"
				interval="5000"
				color="accent"
				maxWidth="auto"
				proportion="25"
				slides="5"
				"[loop]"="true"
				"[hideArrows]"="false"
				"[hideIndicators]"="false"
				"[useKeyboard]"="true"
				"[useMouseWheel]"="false"
				orientation="ltr"
			)
`);
	foreach(step; doc.steps) {
		if(step.action == "followStepsIn") {
			writeStepFollowIn(o, doc, step);
		} else if(step.action == "leftClick") {
			writeStepLeftClick(o, doc, step);
		} else if(step.action == "leftClickNav") {
			writeStepLeftClick(o, doc, step);
		}
	}
}

string makeRelativeToAssests(string s) {
	ptrdiff_t e2e2d = indexOf(s, "e2e2documentation");
	return e2e2d != -1
		? "/assets/" ~ s[e2e2d .. $]
		: "/assets/" ~ s;
}

void writeStepLeftClick(Out)(ref Out o, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-carousel-slide(
					"#matCarouselSlide"
	  				overlayColor="#00000040"
					"[image]"="%s/%s"
	  				"[hideOverlay]"="false"
				)
					h3 You left click on '%s'
`, makeRelativeToAssests(e2e2d.folderName), s.beforeScreenshot, s.selector);

	formattedWrite(o,
`				mat-carousel-slide(
					"#matCarouselSlide"
	  				overlayColor="#00000040"
					"[image]"="%s/%s"
	  				"[hideOverlay]"="false"
				)
					h3 You left click on '%s'
`, makeRelativeToAssests(e2e2d.folderName), s.afterHighlightScreenshot, s.selector);

	if(!s.afterScreenshot.empty) {
		formattedWrite(o,
`				mat-carousel-slide(
					"#matCarouselSlide"
	  				overlayColor="#00000040"
					"[image]"="%s/%s"
	  				"[hideOverlay]"="false"
				)
					h3 You left click on '%s'
`, makeRelativeToAssests(e2e2d.folderName), s.afterScreenshot, s.selector);
	}
}

void writeStepFollowIn(Out)(ref Out o, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-carousel-slide(
					"#matCarouselSlide"
	  				overlayColor="#00000040"
	  				"[hideOverlay]"="false"
				)
					h3 You follow the steps in '%s'
`, s.selector);
}

void copyFolder(string fromFolder, string intoFolder) {
	import std.path : buildPath;
	foreach(it; dirEntries(fromFolder, SpanMode.depth, false)) {
		const dn = dirName(it);
		const fn = baseName(it);
		mkdirRecurse(buildPath(intoFolder, dn));
		copy(it, buildPath(intoFolder, dn, fn));
	}
}

int main(string[] args) {
	const helpWanted = parseArgsWithConfigFile(writeableOptions(), args);
	if(helpWanted) {
		printArgsHelp(options(), "e2e2d angular material carousal generator");
		return 0;
	}

	E2E2D[] files = dirEntries(options().inputFolder, "e2e2d.json", SpanMode.depth)
		.map!(it => it.name.fromFileName())
		.array;

	if(files.empty) {
		writefln("No e2e2d.json files found in %s", options().inputFolder);
		return 1;
	}

	auto parsed = files.map!(it => parseJV(it)).array;
	auto ltw = stdout.lockingTextWriter();
	writeDocs(ltw, parsed);

	return 0;
}
