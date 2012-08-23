(function(){
	/**
	* Main API. Holds translations and language that in turn hold everything else.
	* 
	* Common usage:
	*  var myAlias = translationMemory.getAlias("en_UK");
	*  myAlias("There are {number(count)} things.", {
	*    count: 3
	*  });
	* 
	* Definitions:
	* - Language Code: As defined in UTS #35 such as de_AT (Austrian German). See http://unicode.org/reports/tr35/
	* - Source Key: Patterns with placeholders as typed by a software developer.
	* - Translation Key: Automatically generated keys that are provided to the translator for translation.
	* - Domain: Type of values such as numbers, texts or dates
	* - Category: Group within a domain such as all numbers where the last digit is even (or whatever classification a language requires)
	*/
	var translationMemory = new (function TranslationMemory(){
		var languages = {};
		var translations = {};
		
		/**
		* Loads or updates translations from a JavaScript object
		* @param {string} languageCode
		* @param {Object.<string, string>} pairs Mapping from translation keys to translations
		*/
		this.updateTranslations = function(languageCode, pairs){
			if(!translations.hasOwnProperty(languageCode)){
				translations[languageCode] = {};
			}
			for(var translationKey in pairs){
				translations[languageCode][translationKey] = pairs[translationKey];
			}
		};
		
		/**
		* Adds a new language to the translation memory
		* @param {Language} language
		*/
		this.registerLanguage = function(language){
			languages[language.code] = language;
			this.updateTranslations(language.code, {});
		};
		
		/**
		* @param {string} languageCode
		* @return {Language}
		*/
		this.getLanguage = function(languageCode){
			return languages[languageCode];
		};
		
		/**
		* @param {string} languageCode
		* @return {function(string, Object.<string, *>): string} Function that can be called using a source key and an object with placeholder values. It returns the translated text.
		*/
		this.getAlias = function(languageCode){
			return function(sourceKey, values){
				var translation = new Translation(sourceKey, languages[languageCode]);
				return translation.translate(values || {});
			};
		};
		
		/**
		* @param {Language} language
		* @param {string} translationKey
		* @return {string} Translated text (as proviced by translator where placeholders have not been substituted)
		*/
		this.getTranslation = function(language, translationKey){
			var translation = translations[language.code][translationKey];
			if(typeof(translation)!=="string" && language.fallbackLanguage instanceof Language){
				return this.getTranslation(language.fallbackLanguage, translationKey);
			}
			return translation;
		};
	})();

	function UnsupportedDomain(message){
		if(UnsupportedDomain.innercall===undefined){
			UnsupportedDomain.innercall = true;
			UnsupportedDomain.prototype = new Error(message);
			UnsupportedDomain.prototype.name = "UnsupportedDomain";
			UnsupportedDomain.prototype.constructor = UnsupportedDomain;
			
			return new UnsupportedDomain(message);
		}
		delete UnsupportedDomain.innercall;
	}

	/**
	* Encapsulates what is dependent on a culture.
	* @param {string} code
	* @param {Array.<Domain>} domains
	*/
	function Language(code, domains){
		this.code = code;
		this.domains = domains;
	}
	/**
	 * Adds or updates a domain
	 * @param {Domain} domain
	 * @return {Language}
	 */
	Language.prototype.updateDomain = function(domain){
		for(var i=0; i<this.domains.length; i++){
			if(this.domains[i].name===domain.name){
				break;
			}
		}
		this.domains[i] = domain;
		
		return this;
	};
	/**
	* @param {string} name A domain name
	* @return {Domain} Domain that matches the name
	*/
	Language.prototype.getDomain=function(name){
		var domain = this.domains.reduce(function(previous, current){
			if(current.name===name){
				return current;
			}
			return previous;
		}, null);
		if(domain instanceof Domain){
			return domain;
		}
		if(this.fallbackLanguage instanceof Language){
			return this.fallbackLanguage.getDomain(name);
		}
		throw new UnsupportedDomain(name+" is not a known domain for language "+this.code);
	};
	/**
	 * Creates a new language that uses this language as fallback
	 * @param {String} code
	 * @return {Language}
	 */
	Language.prototype.extend = function(code){
		var language = new Language(code, []);
		language.fallbackLanguage = this;
		return language;
	};

	/**
	* A text fragment that is replaced with a value
	* @param {string} name Name of the placeholder as found in source key. Defines which value is read to replace placeholder.
	* @param {Domain} domain
	*/
	function Placeholder(name, domain){
		this.name = name;
		this.domain = domain;
	}
	/**
	* @param {Language} language
	* @param {string} raw Placeholder fragment as entered in the source key between braces.
	* @return {Placeholder}
	*/
	Placeholder.parse=function(language, raw){
		if(!(language instanceof Language)){
			throw new Error("Language is required.");
		}
		var domainMatch = raw.match(/^([^()]+)\(([^()]*)\)$/);
		var name, domain;
		if(domainMatch===null){
			// Assume value is a plain text unless stated otherwise
			domain = "plain";
			name = raw;
		} else {
			domain = domainMatch[1]
			name = domainMatch[2];
		}
		if(name===""){
			throw new Error("Placeholder names must not be empty.");
		}
		return new Placeholder(name, language.getDomain(domain));
	};

	function DomainMismatch(message){
		if(DomainMismatch.innercall===undefined){
			DomainMismatch.innercall = true;
			DomainMismatch.prototype = new Error(message);
			DomainMismatch.prototype.name = "DomainMismatch";
			DomainMismatch.prototype.constructor = DomainMismatch;
			
			return new DomainMismatch(message);
		}
		delete DomainMismatch.innercall;
	}

	/**
	* Type of values. Similar to classes in many programming languages.
	* @param {string} name Type name
	* @param {function(*):string} formatter Conversion function that transforms any value in a domain to a textual representation
	* @param {Array.<Category>} categories Classification that the language uses to thread values. Categories are queried in sequence to check if they are covering the provided value.
	*/
	function Domain(name, formatter, categories){
		this.name = name;
		this.formatter = formatter;
		this.categories = categories;
	}
	/**
	* @param {*} value
	* @return {Category} The category of the domain that covers the value
	*/
	Domain.prototype.getCategory=function(value){
		for(var i=0; i<this.categories.length; i++){
			if(this.categories[i].represents(value)){
				return this.categories[i];
			}
		}
		throw new DomainMismatch(value+" is not a covered by domain "+this.name);
	};
	/**
	* @param {*} value
	* @return {string} Textual representation of value after transformation
	*/
	Domain.prototype.format = function(value){
		return this.formatter(value);
	}
	/**
	 * Creates a domain based on enumerated category values. For enumerable value domains only.
	 * @param {string} name
	 * @param {string} categoryNames Names and values of category. The same because each category has excatly one value
	 * @param {string} catchAllValue Category and representation to use in case no category matches
	 * @return {Domain}
	 */
	Domain.createByCategoryChecks = function(name, categoryNames, catchAllValue){
		var categories = categoryNames.map(function(categoryName){
			return new Category(categoryName, function(value){
				return value===categoryName;
			});
		});
		var isCatchAll = function(value){
			return categoryNames.indexOf(value)===-1;
		};
		if(catchAllValue!==undefined){
			categories.push(new Category(catchAllValue, isCatchAll));
		}
		return new Domain(name, function(value){
			if(isCatchAll(value)){
				return catchAllValue;
			}
			return String(value);
		}, categories);
	};

	/**
	* Covers values that a language threads in the same way.
	* @param {string} name
	* @param {function(*):boolean} representsCheck Test function to determine whether a value is covered by this category
	*/
	function Category(name, representsCheck){
		this.name = name;
		this.representsCheck = representsCheck;
	}
	/**
	* @param {*} value
	* @return {boolean} True if the category covers the value
	*/
	Category.prototype.represents=function(value){
		return Boolean(this.representsCheck(value));
	};
	Category.prototype.toString=function(){
		return this.name;
	};

	/**
	* A translatable text
	* @param {string} source Source key (what the developer entered)
	* @param {Language} language
	*/
	function Translation(source, language){
		if(!(typeof(source)==="string")){
			throw new Error("Source keys need to be string but got: "+source);
		}
		this.source = source;
		this.language = language;
		
		// Extract all placeholders within the source key
		var matches = source.match(this.pattern) || [];
		this.placeholders = {};
		matches.forEach(function(match){
			var raw = match.substring(1, match.length-1);
			this.placeholders[match] = Placeholder.parse(language, raw);
		}, this);
	}
	/**
	* @type {RegExp} Pattern that matches placeholders in source keys
	*/
	Translation.prototype.pattern = /\{([^{}]*)\}/g;
	/**
	* Performs the translation and inserts values where placeholders have been used
	* @param {Object.<string, string>} values Values to use to replace placeholders
	* @return {string} Translated text with placeholders replaced by values
	*/
	Translation.prototype.translate=function(values){
		var placeholders = this.placeholders;
		var placeholdersByName = {};
		// Calculate which translation to use to insert values
		var outputPattern = this.source.replace(this.pattern, function(match){
			var placeholder = placeholders[match];
			placeholdersByName[placeholder.name] = placeholder;
			if(!values.hasOwnProperty(placeholder.name)){
				throw new Error("No value given for placeholder: "+placeholder.name);
			}
			var value = values[placeholder.name];
			try {
				return "{"+placeholder.domain.getCategory(value)+"("+placeholder.domain.name+"("+placeholder.name+"))}";
			} catch (e){
				e.message = "Cannot substitute placeholder "+placeholder.name+": "+e.message;
				throw e;
			}
		});
		// Insert value in text provided by translator
		var translation = translationMemory.getTranslation(this.language, outputPattern);
		if(typeof(translation)!=="string"){
			// Insert values in source key to have at least something for missing translations. Should never be invoked if the extraction tool processed an application's code.
			translation = this.source.replace(this.pattern, function(match){
				var placeholder = placeholders[match];
				return "{"+placeholder.name+"}";
			});
		}
		return translation.replace(this.pattern, function(match){
			var placeholder = placeholdersByName[match.substring(1, match.length-1)];
			var value = values[placeholder.name];
			return placeholder.domain.format(value);
		});
	};
	/**
	* Calculates all texts that need to be translated in order to cover all possible combinations of categories for a source key.
	* @param {Array.<string>} Translation keys
	*/
	Translation.prototype.getTranslationKeys=function(){
		var placeholders = this.placeholders;
		function expandPlaceholder(placeholder){
			return placeholder.domain.categories.map(function(category){
				// Describe placeholder to translator
				return "{"+category+"("+placeholder.domain.name+"("+placeholder.name+"))}";
			});
		}
		var translationKeys = [
			this.source
		];
		// Calculate permuations
		for(var match in this.placeholders){
			var translationKeysNew = [];
			translationKeys.forEach(function(translationKey){
				expandPlaceholder(placeholders[match]).map(function(expandedPlaceholder){
					translationKeysNew.push(translationKey.split(match).join(expandedPlaceholder));
				});
			});
			translationKeys = translationKeysNew;
		}
		return translationKeys;
	};

	// Initialize language support (happens here until language support gets too big for a single file)
	var plainRule = new Domain("plain", String, [
		new Category("plain", function(){return true;})
	]);
	// Number rules are based on https://developer.mozilla.org/en-US/docs/Localization_and_Plurals
	var numberRule0 = new Domain("number", String, [
		new Category("any", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule1 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("zero", function(value){
			return !isNaN(value) && value!==1;
		})
	]);
	var numberRule2 = new Domain("number", String, [
		new Category("zero", function(value){
			return value===0 || value===1;
		}),
		new Category("two", function(value){
			return !isNaN(value) && value>1;
		})
	]);
	var numberRule3 = new Domain("number", String, [
		new Category("zero", function(value){
			return value===0;
		}),
		new Category("one", function(value){
			return value!==11 && /1$/.test(String(value));
		}),
		new Category("two", function(value){
			return value!==0 && (value===11 || /[234567890]$/.test(String(value)));
		})
	]);
	var numberRule4 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1 || value===11;
		}),
		new Category("two", function(value){
			return value===2 || value===12;
		}),
		new Category("three", function(value){
			return [3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19].indexOf(value)>=0;
		}),
		new Category("zero", function(value){
			return value===0 || value>=20;
		})
	]);
	var numberRule5 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("zero", function(value){
			return value!==1 && (value<20 || /01$/.test(value) || /1\d$/.test(value));
		}),
		new Category("twenty", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule6 = new Domain("number", String, [
		new Category("one", function(value){
			return value!==11 && /1$/.test(value);
		}),
		new Category("zero", function(value){
			return /0$/.test(value) || /1[123456789]$/.test(value);
		}),
		new Category("two", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule7 = new Domain("number", String, [
		new Category("one", function(value){
			return value!==11 && /1$/.test(value);
		}),
		new Category("two", function(value){
			return [12, 13, 14].indexOf(value)===-1 && /[234]$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule8 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("two", function(value){
			return [2, 3, 4].indexOf(value)>=0;
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule9 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("two", function(value){
			return [12, 13, 14].indexOf(value)===-1 && /[234]$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule10 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1 || /01$/.test(value);
		}),
		new Category("two", function(value){
			return value===2 || /02$/.test(value);
		}),
		new Category("three", function(value){
			return value===3 || value===4 || /03$/.test(value) || /04$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule11 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("two", function(value){
			return value===2;
		}),
		new Category("three", function(value){
			return [3, 4, 5, 6].indexOf(value)>=0;
		}),
		new Category("seven", function(value){
			return [7, 8, 9, 10].indexOf(value)>=0;
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule12 = new Domain("number", String, [
		new Category("zero", function(value){
			return value===0;
		}),
		new Category("one", function(value){
			return value===1;
		}),
		new Category("two", function(value){
			return value===2;
		}),
		new Category("three", function(value){
			return [3, 4, 5, 6, 7, 8, 9].indexOf(value)>=0 || /10$/.test(value);
		}),
		new Category("eleven", function(value){
			return /00$/.test(value) || /01$/.test(value) || /02$/.test(value);
		}),
		new Category("else", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule13 = new Domain("number", String, [
		new Category("one", function(value){
			return value===1;
		}),
		new Category("zero", function(value){
			return [0, 2, 3, 4, 5, 6, 7, 8, 9].indexOf(value)>=0 || /0\d$/.test(value) || /10$/.test(value);
		}),
		new Category("eleven", function(value){
			return /1\d$/.test(value);
		}),
		new Category("twenty", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule14 = new Domain("number", String, [
		new Category("one", function(value){
			return /1$/.test(value);
		}),
		new Category("two", function(value){
			return /2$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule15 = new Domain("number", String, [
		new Category("one", function(value){
			return value!==11 && /1$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	var numberRule16 = new Domain("number", String, [
		new Category("one", function(value){
			return /1$/.test(value) && [11, 71, 91].indexOf(value)===-1;
		}),
		new Category("two", function(value){
			return /2$/.test(value) && [12, 72, 92].indexOf(value)===-1;
		}),
		new Category("three", function(value){
			return (/3$/.test(value) || /4$/.test(value) || /9$/.test(value)) && [13, 14, 19, 73, 74, 79, 93, 94, 99].indexOf(value)===-1;
		}),
		// Verify this category exists
		new Category("million", function(value){
			return /000000$/.test(value);
		}),
		new Category("zero", function(value){
			return !isNaN(value);
		})
	]);
	translationMemory.registerLanguage(
		/**
		 * Base language with domains to be overridden.
		 */
		new Language("root", [
			plainRule,
			numberRule0,
			Domain.createByCategoryChecks("gender", ["♂", "♀"], "⚪")
		])
	);
	translationMemory.registerLanguage(
		translationMemory.getLanguage("root").extend("de")
		.updateDomain(numberRule1)
		.updateDomain(
			new Domain("gender", function(gender){
				switch(gender){
					case "male":
						return "männlich";
					case "female":
						return "weiblich";
				}
				return "unbestimmt";
			}, [
				new Category("male", function(value){
					return value==="male";
				}),
				new Category("female", function(value){
					return value==="female";
				}),
				new Category("unknown", function(value){
					return value!=="male" && value!=="female";
				})
			])
		)
	);
	translationMemory.registerLanguage(translationMemory.getLanguage("de").extend("de_AT"));
	translationMemory.registerLanguage(translationMemory.getLanguage("de").extend("de_CH"));
	translationMemory.registerLanguage(translationMemory.getLanguage("de").extend("de_DE"));
	// Existing languages can also be extended for application specific domains
	translationMemory.getLanguage("de").updateDomain(new Domain("date", function(date){
		return (date.getDate()+"."+date.getMonth()+"."+date.getFullYear()).replace(/\b(\d\.)/g, "0$1");
	}, [
		new Category("date", function(date){
			return date instanceof Date;
		})
	]));
	
	translationMemory.registerLanguage(
		translationMemory.getLanguage("root").extend("en")
		.updateDomain(numberRule1)
		.updateDomain(
			new Domain("gender", function(gender){
				switch(gender){
					case "male":
					case "female":
						return gender;
				}
				return "unknown";
			}, [
				new Category("male", function(value){
					return value==="male";
				}),
				new Category("female", function(value){
					return value==="female";
				}),
				new Category("unknown", function(value){
					return value!=="male" && value!=="female";
				})
			])
		)
	);
	translationMemory.registerLanguage(translationMemory.getLanguage("en").extend("en_UK"));
	translationMemory.registerLanguage(translationMemory.getLanguage("en").extend("en_US"));
	translationMemory.registerLanguage(
		translationMemory.getLanguage("root").extend("it")
		.updateDomain(numberRule1)
		.updateDomain(
			new Domain("gender", function(gender){
				switch(gender){
					case "male":
						return "maschile";
					case "female":
						return "femminile";
				}
				return "sconosciuto";
			}, [
				new Category("male", function(value){
					return value==="male";
				}),
				new Category("female", function(value){
					return value==="female";
				}),
				new Category("unknown", function(value){
					return value!=="male" && value!=="female";
				})
			])
		)
	);
	translationMemory.registerLanguage(translationMemory.getLanguage("it").extend("it_CH"));
	translationMemory.registerLanguage(translationMemory.getLanguage("it").extend("it_IT"));
	translationMemory.registerLanguage(
		translationMemory.getLanguage("root").extend("fr")
		.updateDomain(numberRule2)
		.updateDomain(
			new Domain("gender", function(gender){
				switch(gender){
					case "male":
						return "mâle";
					case "female":
						return "femelle";
				}
				return "inconnu";
			}, [
				new Category("male", function(value){
					return value==="male";
				}),
				new Category("female", function(value){
					return value==="female";
				}),
				new Category("unknown", function(value){
					return value!=="male" && value!=="female";
				})
			])
		)
	);
	translationMemory.registerLanguage(translationMemory.getLanguage("fr").extend("fr_CH"));
	translationMemory.registerLanguage(translationMemory.getLanguage("fr").extend("fr_FR"));
	
	translationMemory.registerLanguage(
		translationMemory.getLanguage("root").extend("gd")
	);
	translationMemory.registerLanguage(translationMemory.getLanguage("gd").extend("gd_SCO").updateDomain(numberRule4));
	translationMemory.registerLanguage(translationMemory.getLanguage("gd").extend("gd_IR").updateDomain(numberRule11));

	var exportsHolder;
	if(this.window===undefined){
		// Export constructors and translation memory for use with nodejs
		exportsHolder = exports;
	} else {
		// Make API available when running in a browser
		exportsHolder = window.translatables = {};
	}
	exportsHolder.Translation = Translation;
	exportsHolder.Language = Language;
	exportsHolder.Domain = Domain;
	exportsHolder.Category = Category;
	exportsHolder.translationMemory = translationMemory;
})();