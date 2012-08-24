var translatables = require("../translatables");

exports["Alias callable"] = function(test){
	var t = translatables.translationMemory.getAlias("root");
	test.ok(t instanceof Function);
	
	var translatedText = t("Just a test");
	test.ok(typeof(translatedText)==="string");
	
	test.done();
};

exports["Translate to German"] = function(test){
	var german = translatables.translationMemory.getLanguage("de");
	translatables.translationMemory.updateTranslations("de", {
		"{zero(number(c))} tree": "{c} Bäume",
		"{one(number(c))} tree": "{c} Baum"
	});
	
	var t = translatables.translationMemory.getAlias("de");
	test.ok("0 Bäume"===t("{number(c)} tree", {
		c: 0
	}));
	test.ok("1 Baum"===t("{number(c)} tree", {
		c: 1
	}));
	test.ok("5 Bäume"===t("{number(c)} tree", {
		c: 5
	}));
	
	test.done();
};

exports["Permutations"] = function(test){
	var fakeLanguage = translatables.translationMemory.getLanguage("root").extend("fake")
		.updateDomain(
			new translatables.Domain("fake", String, [
				new translatables.Category("fake1", function(){}),
				new translatables.Category("fake2", function(){})
			])
		);
	var translationDistinctPlaceholders = new translatables.Translation("Some {fake(testOne)} sample text {fake(other)} plus more.", fakeLanguage);
	test.ok(translationDistinctPlaceholders.getTranslationKeys().length===4, "Two placeholders which two categories each should result in 4 translation keys.");
	var translationEqualPlaceholders = new translatables.Translation("Some {fake(testOne)} sample text {fake(testOne)} plus more.", fakeLanguage);
	test.ok(translationEqualPlaceholders.getTranslationKeys().length===2, "Using the same placeholder twice should not result in an excess of translation keys.");
	
	test.done();
};