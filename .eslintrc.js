module.exports = {
  "env": {
    "browser": true,
    "es6": true,
    "node": true,
    "jest": true,
  },
  "extends": "eslint:recommended",
  "globals": {
    "$": "readonly",
    "CONFIG_FILE_NAME": "readonly",
    "IS_TEST": "readonly",
    "IS_SINGLE": "readonly",
    "LANG_CODE": "readonly",
    "OO": "readonly",
    "convenientDiscussions": "readonly",
    "jest": "readonly",
    "expect": "readonly",
    "mw": "readonly",
    "require": "readonly",
    "getUrlFromInterwikiLink": "readonly",  // en:User:Jack who built the house/getUrlFromInterwikiLink.js
    "getInterwikiPrefixForHostname": "readonly",  // en:User:Jack who built the house/getUrlFromInterwikiLink.js
    "getInterwikiPrefixForHostnameSync": "readonly",  // en:User:Jack who built the house/getUrlFromInterwikiLink.js
  },
  "ignorePatterns": ["dist/**", "misc/**", "*.json5", "w-he.js"],
  "overrides": [
    {
      "files": ["./*.js", "src/tribute/**", "*.test.js"],
      "rules": {
        "jsdoc/require-jsdoc": "off",
      },
    },
  ],
  "parser": "babel-eslint",
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
  },
  "plugins": [
    "sort-imports-es6-autofix",
    "jsdoc",
  ],
  "rules": {
    "jsdoc/check-alignment": "warn",
    "jsdoc/check-param-names": "warn",
    "jsdoc/check-tag-names": "warn",
    "jsdoc/check-types": "warn",
    "jsdoc/implements-on-classes": "warn",
    "jsdoc/newline-after-description": "warn",
    "jsdoc/no-undefined-types": "warn",
    "jsdoc/require-jsdoc": ["warn", {
      "require": {
        "FunctionDeclaration": true,
        "MethodDefinition": true,
        "ClassDeclaration": true,
        "ClassExpression": true,
      },
    }],
    "jsdoc/require-param": "warn",
    // "jsdoc/require-param-description": "warn",
    "jsdoc/require-param-name": "warn",
    "jsdoc/require-param-type": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-returns-check": "warn",
    // "jsdoc/require-returns-description": "warn",
    "jsdoc/require-returns-type": "warn",
    "jsdoc/valid-types": "warn",
    "no-constant-condition": ["error", { "checkLoops": false }],
    "no-control-regex": "off",
    "no-duplicate-case": "off",
    "no-sparse-arrays": "off",
    "no-unexpected-multiline": "off",
    "no-unused-vars": ["error", { "args": "after-used" }],
    "require-atomic-updates": "off",
    "sort-imports-es6-autofix/sort-imports-es6": ["warn", {
      "ignoreCase": false,
      "ignoreMemberSort": false,
      "memberSyntaxSortOrder": ["none", "all", "single", "multiple"],
    }],
  },
};
