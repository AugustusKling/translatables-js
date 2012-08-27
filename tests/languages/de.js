var translatables = require("../../translatables");

exports["Translation key generation for numbers"] = function(test){
	var translation = new translatables.Translation("Pop it in the oven for {number(h)} hours and {number(other)} minutes.", translatables.translationMemory.getLanguage("de_DE"));
	var translationKeys = translation.getTranslationKeys();
	test.ok(translationKeys.length===4);
	test.ok(translationKeys.indexOf("Pop it in the oven for {one(number(h))} hours and {one(number(other))} minutes.")>=0);
	test.ok(translationKeys.indexOf("Pop it in the oven for {one(number(h))} hours and {zero(number(other))} minutes.")>=0);
	test.ok(translationKeys.indexOf("Pop it in the oven for {zero(number(h))} hours and {one(number(other))} minutes.")>=0);
	test.ok(translationKeys.indexOf("Pop it in the oven for {zero(number(h))} hours and {zero(number(other))} minutes.")>=0);
	test.done();
};