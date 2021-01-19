import std.algorithm.iteration : map;
import std.range : tee;
import std.array;
import std.stdio;
import std.json;
import std.path;
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


struct Entry {
	string action;
	string selector;
	string doc;
	string beforeScreenshot;
	string afterHighlightScreenshot;
	string afterScreenshot;
}

struct E2E2D {
	string folderName;
	JSONValue jv;

	Entry[] steps;
}

string get(JSONValue jv, string key) {
	return key in jv
		? jv[key].get!string()
		: "";
}

E2E2D parseJV(E2E2D input) {
	foreach(key, JSONValue value; input.jv["steps"].arrayNoRef()) {
		Entry e;
		foreach(mem; __traits(allMembers, Entry)) {
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
	writeln(parsed);

	return 0;
}
