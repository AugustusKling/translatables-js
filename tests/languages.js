var translatables = require("../translatables");

exports["Root language exists"] = function(test){
	var root = translatables.translationMemory.getLanguage("root");
	test.ok(root instanceof translatables.Language);
	test.done();
};

exports["Core domains supported"] = function(test){
	var root = translatables.translationMemory.getLanguage("root");
	
	var numberDomain = root.getDomain("number");
	test.ok(numberDomain instanceof translatables.Domain);
	test.ok(numberDomain.getCategory(0) instanceof translatables.Category);
	test.ok(numberDomain.getCategory(1) instanceof translatables.Category);
	test.ok(numberDomain.getCategory(2) instanceof translatables.Category);
	
	var plainDomain = root.getDomain("plain");
	test.ok(plainDomain instanceof translatables.Domain);
	test.ok(plainDomain.getCategory("some value") instanceof translatables.Category);
	
	test.done();
};

exports["Custom domains"] = function(test){
	var root = translatables.translationMemory.getLanguage("root");
	var lang = root.extend("mylang");
	test.ok(lang instanceof translatables.Language);
	test.ok(root!==lang);
	
	var domain = new translatables.Domain("mydomain");
	var stillLang = lang.updateDomain(domain);
	test.ok(stillLang===lang);
	test.ok(domain===lang.getDomain("mydomain"));
	
	test.done();
};