var translatables = require("../../translatables");

exports.setUp = function(done){
	this.language = translatables.translationMemory.getLanguage("root");
	this.t = translatables.translationMemory.getAlias("root");
	done();
};

exports["Base types supported"] = function(test){
	test.ok(typeof(this.t("Hello"))==="string");
	test.ok(typeof(this.t("Hello {name}", {
		name: "Scott"
	}))==="string");
	test.ok(typeof(this.t("Hello {plain(name)}", {
		name: ""
	}))==="string");
	test.ok(typeof(this.t("{number(something)} goats.", {
		something: 6
	}))==="string");
	test.ok(typeof(this.t("{gender(something)} person.", {
		something: "female"
	}))==="string");
	
	var translation = new translatables.Translation("test text", this.language);
	var translationKeys = translation.getTranslationKeys();
	test.ok(translationKeys.length===1);
	test.done();
};

exports["Incomplete values refused"] = function(test){
	test.throws(function(){
		this.t("Hello {void}");
	});
	test.throws(function(){
		this.t("Hello {void}", {});
	});
	test.throws(function(){
		this.t("Hello {void}", {
			other: 5
		});
	});
	var translatedValue = this.t("Hello {void}", {
		"void": undefined
	});
	test.ok(typeof(translatedValue)==="string");
	test.done();
};

exports["Category mismatches refused"] = function(test){
	test.throws(function(){
		this.t("{number(your_count)} fighting goats", {
			your_count: "not a number"
		});
	});
	test.done();
};

exports["Dates supported"] = function(test){
	var translatedOfLastYearsWeek = this.t("{date(value)}", {
		value: new Date(2010, 0, 2)
	});
	test.equal(translatedOfLastYearsWeek, "2010-01-02");
	test.done();
};