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
			return translations[language.code][translationKey];
		};
	})();

	function UnsupportedDomain(message){
		this.message = message;
	}
	UnsupportedDomain.prototype = new Error();

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
	 */
	Language.prototype.updateDomain = function(domain){
		for(var i=0; i<this.domains.length; i++){
			if(this.domains[i].name===domain.name){
				break;
			}
		}
		this.domains[i] = domain;
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
		throw new UnsupportedDomain(name+" is not a known domain for language "+this.code);
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
		return new Placeholder(name, language.getDomain(domain));
	};

	function DomainMismatch(message){
		this.message = message;
	}
	DomainMismatch.prototype = new Error();

	/**
	* Type of values. Similar to classes in many programming languages.
	* @param {string} name Type name
	* @param {function(*):string} formatter Conversion function that transforms any value in a domain to a textual representation
	* @param {Array.<Category>} categories Classification that the language uses to thread values
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
			throw new Error("Translation for pattern missing: "+outputPattern);
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
	translationMemory.registerLanguage(
		new Language("de_DE", [
			new Domain("number", String, [
				new Category("one", function(value){
					return value===1;
				}),
				new Category("multiple", function(value){
					return !isNaN(value) && value!==1;
				})
			]),
			new Domain("plain", String, [
				new Category("plain", function(){return true;})
			]),
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
		])
	);
	// Existing languages can also be extended for application specific domains
	translationMemory.getLanguage("de_DE").updateDomain(new Domain("date", function(date){
		return (date.getDate()+"."+date.getMonth()+"."+date.getFullYear()).replace(/\b(\d\.)/g, "0$1");
	}, [
		new Category("date", function(date){
			return date instanceof Date;
		})
	]));

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