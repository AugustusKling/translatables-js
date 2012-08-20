/**
 * Parses all files in codebase for calls to the aliased function. Creates/updates translations in language.
 * Finds for example:
 * - t("Hello {name}, it's you.", {name:"you"})
 * - t('{number(count)} apples.', {count:14})
 */

var program = require("commander");
program.version("0")
	.option("--codebase <path>", "Root of program code (file or directory) to parse")
	.option("--alias <name>", "Name of function that is used in the codebase to translate", String, "t")
	.option("--language <language code>", "Language to generate")
	.option("--language-folder <path>", "Folder in which translations are stored. Default is working directory.",  String, "./")
	.option("--discard-unused", "Deletes no longer used translations")
	.option("--discard-empty", "Deletes translation keys that point to empty translations")
	.parse(process.argv);

var translatables = require("./translatables");
var fs = require("fs");
var path = require("path");

var extractedTranslations = {};
var translationFilePath = program.languageFolder.replace(/([^/])$/, "$1/") + program.language+".js";
// Load existing translations
if(path.existsSync(translationFilePath)){
	extractedTranslations = JSON.parse(fs.readFileSync(translationFilePath).toString());
}

// Parse code for translations
var translationKeysPresent = [];
var pattern = new RegExp("\\b"+program.alias+"\\(((?:\"[^\"]*)|(?:'[^']*))", "g");
function addSourceKeyFromFile(path){
	var content = fs.readFileSync(path).toString();
	var match;
	while(match = pattern.exec(content)){
		// Add translation keys for each source key
		var sourceKey = match[1].substring(1);
		var translation = new translatables.Translation(sourceKey, translatables.translationMemory.getLanguage(program.language));
		translation.getTranslationKeys().forEach(function(translationKey){
			translationKeysPresent.push(translationKey);
			if(typeof(extractedTranslations[translationKey])!=="string"){
				extractedTranslations[translationKey] = "";
			}
		});
	}
}
function parseDirectory(path){
	var stats = fs.statSync(path);
	if(stats.isDirectory()){
		fs.readdirSync(path).forEach(function(name){
			parseDirectory(path+"/"+name);
		});
	} else {
		addSourceKeyFromFile(path);
	}
}
parseDirectory(program.codebase);

Object.keys(extractedTranslations).forEach(function(sourceKey){
	// Discard unused translations
	if(program.discardUnused && translationKeysPresent.indexOf(sourceKey)===-1){
		delete extractedTranslations[sourceKey];
	}
	// Discard empty translations
	if(program.discardEmpty && extractedTranslations[sourceKey]===""){
		delete extractedTranslations[sourceKey];
	}
});

// Generate/update translations
fs.writeFileSync(translationFilePath, JSON.stringify(extractedTranslations, null, "\t"));