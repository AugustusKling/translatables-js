var translatables = require("../../translatables");

exports["Translation key generation for numbers"] = function(test){
	var translation = new translatables.Translation("{number(c)} tree", translatables.translationMemory.getLanguage("en"));
	var translationKeys = translation.getTranslationKeys();
	test.ok(translationKeys.length===2);
	test.ok(translationKeys.indexOf("{zero(number(c))} tree")>=0);
	test.ok(translationKeys.indexOf("{one(number(c))} tree")>=0);
	test.done();
};