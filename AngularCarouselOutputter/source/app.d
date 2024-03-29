import std.algorithm.iteration : map;
import std.algorithm.searching : endsWith;
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
	string assetsFolder;
	@Arg()
	string ngCarouselFileName;
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

	formattedWrite(o, `mat-accordion(style="min-width: 85%%; width: 85%%; margin: 0px")
`);
	foreach(it; docs) {
		formattedWrite(o, "\tmat-expansion-panel\n\t\tmat-expansion-panel-header\n"
			~ "\t\t\tmat-panel-title %s\n\t\tmat-dialog-content\n"
			, it.title);
		writeDoc(o, it);
	}
}

void writeDoc(Out)(ref Out o, E2E2D doc) {
	formattedWrite(o,
`			div("fxLayout"="row wrap" "fxLayoutGap"="64 grid"
				"fxLayoutAlign"="space-between space-between"
			)
`);
	foreach(idx, step; doc.steps) {
		if(step.action == "followStepsIn") {
			writeStepFollowIn(o, idx, doc, step);
		} else if(step.action == "leftClick") {
			writeStepLeftClick(o, idx, doc, step);
		} else if(step.action == "leftClickNav") {
			writeStepLeftClick(o, idx, doc, step);
		} else if(step.action == "insert") {
			writeStepInsert(o, idx, doc, step);
		} else if(step.action == "should") {
			writeStepShould(o, idx, doc, step);
		} else if(step.action == "navTo") {
			writeStepNavTo(o, idx, doc, step);
		}
	}
}

string makeRelativeToAssests(string s) {
	ptrdiff_t e2e2d = indexOf(s, "e2e2documentation");
	return e2e2d != -1
		? "/assets/" ~ s[e2e2d .. $]
		: "/assets/" ~ s;
}

string imgHelper(string path, string fn) {
	string r = "\n\t\t\t\t\timg(\"mat-card-image\" src=\"%1$s/%2$s\""
		~ "\t\t\t\t\t\t\"(click)\"=\"openImage('%1$s/%2$s')\")";
	return !fn.endsWith(".png")
		? ""
		: format(r, path, fn);
}

string escapeSelector(string sel) {
	return sel.replace("#", "&num;");
}

void writeStepNavTo(Out)(ref Out o, size_t idx, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.0
						mat-card-subtitle You navigate to
					mat-card-content
						p.
							You type the url %1$s into your browser's navigation
							bar
						p '%3$s'
`, s.selector.escapeSelector(), idx, s.doc);
}

void writeStepShould(Out)(ref Out o, size_t idx, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.0
						mat-card-subtitle Compare%3$s
					mat-card-content
						p '%1$s'
`, s.doc, idx, imgHelper(makeRelativeToAssests(e2e2d.folderName), s.beforeScreenshot)
	);

	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.1
						mat-card-subtitle Compare highlighted%3$s
					mat-card-content
						p '%1$s'
`, s.doc, idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.afterHighlightScreenshot));
}

void writeStepInsert(Out)(ref Out o, size_t idx, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.0
						mat-card-subtitle You insert data%3$s
					mat-card-content
						p You insert data into '%1$s'
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.beforeScreenshot));

	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.1
						mat-card-subtitle You insert data%3$s
					mat-card-content
						p You insert data into '%1$s'
						p The field to insert into is highlighted
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName)
	, s.afterHighlightScreenshot));

	if(!s.afterScreenshot.empty) {
		formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.1
						mat-card-subtitle You insert data%3$s
					mat-card-content
						p You insert data into '%1$s'
						p The field to insert into is highlighted
						p The way it should look after you inserted the data
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.afterScreenshot));
	}
}

void writeStepLeftClick(Out)(ref Out o, size_t idx, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-card
					mat-card-header
						mat-card-title Step %2$s.0
						mat-card-subtitle Left click%3$s
					mat-card-content
						p %4$s %1$s.0
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.beforeScreenshot), s.doc);

	formattedWrite(o,
`				mat-card("fxFlex"="20%%")
					mat-card-header
						mat-card-title Step %2$s.1
						mat-card-subtitle Left click highlighted%3$s
					mat-card-content
						p %4$s '%1$s.1'
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.beforeScreenshot), s.doc);

	if(!s.afterScreenshot.empty) {
		formattedWrite(o,
`				mat-card("fxFlex"="20%%")
					mat-card-header
						mat-card-title Step %2$s.2
						mat-card-subtitle Left click after click%3$s
					mat-card-content
						p %4$s '%1$s'.2
`, s.selector.escapeSelector(), idx, imgHelper(makeRelativeToAssests(e2e2d.folderName),
	s.beforeScreenshot), s.doc);
	}
}

void writeStepFollowIn(Out)(ref Out o, size_t idx, E2E2D e2e2d, Step s) {
	formattedWrite(o,
`				mat-card("fxFlex"="20%%")
					mat-card-header
						mat-card-title Step %2$s.0
						mat-card-subtitle You left click
					mat-card-content
						p You follow the steps in tutorial
						p %1$s
						p %3$s
`, s.selector.escapeSelector(), idx, s.doc);
}

void copyFolder(string fromFolder, string intoFolder) {
	foreach(it; dirEntries(fromFolder, SpanMode.depth, false)) {
		const newName = it.name[fromFolder.length + 1 .. $];
		if(isDir(it.name)) {
			mkdirRecurse(buildPath(intoFolder, newName));
		} else {
			string oPath = buildPath(intoFolder, newName);
			string dName = dirName(oPath);
			mkdirRecurse(dName);
			copy(it.name, oPath);
		}
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
	if(options().ngCarouselFileName.empty) {
		auto ltw = stdout.lockingTextWriter();
		writeDocs(ltw, parsed);
	} else {
		auto f = File(options().ngCarouselFileName, "w");
		auto ltw = f.lockingTextWriter();
		writeDocs(ltw, parsed);
	}

	if(options().assetsFolder) {
		string oFolder = buildPath(options().assetsFolder, "e2e2documentation");
		copyFolder(options().inputFolder, oFolder);
	}

	return 0;
}
