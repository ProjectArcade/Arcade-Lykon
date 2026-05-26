--- browser/components/preferences/config/lykonShield.mjs
+++ browser/components/preferences/config/lykonShield.mjs
@@ -271,6 +271,15 @@
         id: "lykonAutomaticallySubmitCrashes",
         l10nId: "lykon-data-collection-backlogged-crash-reports",
         control: "moz-toggle",
+        items: [
+          {
+            id: "lykonViewCrashesLink",
+            control: "moz-box-link",
+            l10nId: "lykon-data-collection-crashes-link",
+            controlAttrs: {
+              href: "about:crashes",
+            },
+          },
+        ],
       },
     ],
   },
