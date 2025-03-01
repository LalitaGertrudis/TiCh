#!/usr/bin/env node

// Using modern require statements without the problematic natives package
const program = require("commander");
const chalk = require("chalk");
const updateNotifier = require("update-notifier");
const fs = require("fs");
const tiappxml = require("tiapp.xml");
const pkg = require("../package.json");
const xpath = require("xpath");
const copy = require("copy-files");
const { ncp } = require("ncp");
const { exec } = require("child_process");

let alloyCfg;
let isAlloy = false;

tich();

// main function
function tich() {
  // status command, shows the current config
  function status() {
    const tiapp = tiappxml.load(outfile);
    let alloyCfg;
    let isAlloy = false;

    if (fs.existsSync("./app/config.json")) {
      isAlloy = true;
      alloyCfg = JSON.parse(fs.readFileSync("./app/config.json", "utf-8"));
    }

    console.log("\n");
    console.log("Name: " + chalk.cyan(tiapp.name));
    console.log("AppId: " + chalk.cyan(tiapp.id));
    console.log("Version: " + chalk.cyan(tiapp.version));
    console.log("GUID: " + chalk.cyan(tiapp.guid));

    if (isAlloy) {
      console.log(
        "Alloy Theme: " + chalk.cyan(alloyCfg.global.theme || "not defined"),
      );
    }

    console.log("\n");
  }

  function availableApps() {
    return cfg.configs.map(function (o) {
      return o.name;
    });
  }

  function appExists(name) {
    return availableApps().indexOf(name) !== -1;
  }

  function copyTesters() {
    console.log("## Copy Pilot testers...");
    const fileName = "tester_import.csv";
    const filePath = "./pilot/" + alloyCfg.global.theme + "/" + fileName;
    const pilotPath = "./TiFLPilot/";

    exec("rm -rf " + pilotPath, function () {
      if (fs.existsSync(filePath)) {
        fs.mkdirSync(pilotPath, { recursive: true });

        copy(
          {
            files: {
              "tester_import.csv": filePath,
            },
            dest: pilotPath,
            overwrite: true,
          },
          function (err) {
            if (err) {
              console.log(
                chalk.red(
                  "Error copying " + fileName + " for " + alloyCfg.global.theme,
                ),
              );
            } else {
              console.log(chalk.cyan("Copy Pilot testers done"));
            }

            status();
          },
        );
      } else {
        console.log(chalk.yellow("Pilot testers not found"));
        status();
      }
    });
  }

  function copyDefaultIcon() {
    console.log("## Update default icon...");
    const defaultIcon = "./app/assets/iphone/iTunesArtwork@2x.png";

    if (fs.existsSync(defaultIcon)) {
      copy(
        {
          files: {
            "DefaultIcon.png": defaultIcon,
          },
          dest: "./",
          overwrite: true,
        },
        function (err) {
          console.log(chalk.cyan("Updating DefaultIcon.png done"));
          copyDefaultLaunchLogo();
        },
      );
    } else {
      //continue
      copyDefaultLaunchLogo();
    }
  }

  function copyDefaultLaunchLogo() {
    console.log("#### Update default launch logo...");
    const defaultLaunchLogo = "./app/assets/iphone/LaunchLogo.png";

    if (fs.existsSync(defaultLaunchLogo)) {
      copy(
        {
          files: {
            "LaunchLogo.png": defaultLaunchLogo,
          },
          dest: "./",
          overwrite: true,
        },
        function (err) {
          console.log(chalk.cyan("Updating LaunchLogo.png done"));
          copyNotificationIcons();
        },
      );
    } else {
      //continue
      console.log(chalk.red(defaultLaunchLogo + " not found"));
      copyNotificationIcons();
    }
  }

  function copyNotificationIcons() {
    console.log("#### Update notification icons for FCM...");

    const filePath = "./.sh/notification_icon.sh";

    if (fs.existsSync(filePath)) {
      exec(`. ${filePath} ${alloyCfg.global.theme}`, function () {
        console.log(chalk.cyan("Updating notification icons done"));
        copyTesters();
      });
    } else {
      //continue
      copyTesters();
    }
  }

  function copyThemePlatformAssets() {
    console.log("### Copy Platform assets");

    exec("rm -r ./app/platform/*", function () {
      console.log(chalk.cyan("App Platform cleaned"));

      //default assets for all projects
      const globalPlatformDirectory = "./app/themes/global/platform";

      if (fs.existsSync(globalPlatformDirectory)) {
        ncp(globalPlatformDirectory, "./app/platform/", function (err) {
          if (err) {
            console.error(err);
          }

          console.log(chalk.cyan("Global assets copied"));
          const platformDirectory =
            "./app/themes/" + alloyCfg.global.theme + "/platform/";

          if (fs.existsSync(platformDirectory)) {
            ncp(platformDirectory, "./app/platform/", function (err) {
              if (err) {
                console.error(chalk.red("Error found: " + err));
              } else {
                console.log("Platform from " + platformDirectory + " copied");
              }

              //Continue copying icons
              copyDefaultIcon();
            });
          } else {
            //Continue copying icons
            copyDefaultIcon();
          }
        });
      }
    });
  }

  // select a new config by name
  function select(name, outfilename) {
    const regex = /\$tiapp\.(.*)\$/;

    if (!name) {
      console.log(chalk.red("No config specified, nothing to do."));
      process.exit(1);
    } else if (!appExists(name)) {
      console.log(chalk.red("App not available"));
      process.exit(1);
    } else {
      cfg.configs.forEach(function (config) {
        if (config.name === name) {
          if (config.hasOwnProperty("tiapp")) {
            infile = "./TiCh/templates/" + config.tiapp;

            if (!fs.existsSync(infile)) {
              console.log(chalk.red("Cannot find " + infile));
              process.exit(1);
            }
          }
        }
      });

      // read in the app config
      const tiapp = tiappxml.load(infile);

      alloyCfg = undefined;
      isAlloy = false;

      if (fs.existsSync("./app/config.json")) {
        isAlloy = true;
        alloyCfg = JSON.parse(fs.readFileSync("./app/config.json", "utf-8"));
      }

      // find the config name specified
      cfg.configs.forEach(function (config) {
        if (config.name === name || config.name === "global") {
          console.log("\nFound a config for " + chalk.cyan(config.name) + "\n");

          for (const setting in config.settings) {
            if (!config.settings.hasOwnProperty(setting)) continue;

            if (setting != "properties" && setting != "raw") {
              const now = new Date();
              let replaceWith = config.settings[setting]
                .replace("$DATE$", now.toLocaleDateString())
                .replace("$TIME$", now.toLocaleTimeString())
                .replace("$DATETIME$", now.toLocaleString())
                .replace("$TIME_EPOCH$", now.getTime().toString());

              const matches = regex.exec(replaceWith);

              if (matches && matches[1]) {
                const propName = matches[1];
                replaceWith = replaceWith.replace(regex, tiapp[propName]);
              }

              tiapp[setting] = replaceWith;

              console.log(
                "Changing " +
                  chalk.cyan(setting) +
                  " to " +
                  chalk.yellow(replaceWith),
              );
            }
          }

          if (config.settings.properties) {
            for (const property in config.settings.properties) {
              if (!config.settings.properties.hasOwnProperty(property))
                continue;

              let replaceWith = config.settings.properties[property]
                .replace("$DATE$", new Date().toLocaleDateString())
                .replace("$TIME$", new Date().toLocaleTimeString())
                .replace("$DATETIME$", new Date().toLocaleString())
                .replace("$TIME_EPOCH$", new Date().getTime().toString());

              const matches = regex.exec(replaceWith);
              if (matches && matches[1]) {
                const propName = matches[1];
                replaceWith = replaceWith.replace(regex, tiapp[propName]);
              }

              tiapp.setProperty(property, replaceWith);

              console.log(
                "Changing App property " +
                  chalk.cyan(property) +
                  " to " +
                  chalk.yellow(replaceWith),
              );
            }
          }

          if (config.settings.raw) {
            const doc = tiapp.doc;
            const select = xpath.useNamespaces({
              ti: "http://ti.appcelerator.org",
              android: "http://schemas.android.com/apk/res/android",
              ios: "",
            });
            for (const path in config.settings.raw) {
              if (!config.settings.raw.hasOwnProperty(path)) continue;

              const node = select(path, doc, true);
              if (!node) {
                console.log(
                  chalk.yellow("Could not find " + path + ", skipping"),
                );
                continue;
              }

              let replaceWith = config.settings.raw[path]
                .replace("$DATE$", new Date().toLocaleDateString())
                .replace("$TIME$", new Date().toLocaleTimeString())
                .replace("$DATETIME$", new Date().toLocaleString())
                .replace("$TIME_EPOCH$", new Date().getTime().toString());

              const matches = regex.exec(replaceWith);

              if (matches && matches[1]) {
                const propName = matches[1];
                replaceWith = replaceWith.replace(regex, tiapp[propName]);
              }

              if (typeof node.value === "undefined") {
                node.firstChild.data = replaceWith;
              } else {
                node.value = replaceWith;
              }

              console.log(
                "Changing Raw property " +
                  chalk.cyan(path) +
                  " to " +
                  chalk.yellow(replaceWith),
              );
            }
          }

          if (config.name != "global") {
            //Update theme on Alloy config only if it's not global configuration
            if (isAlloy && processAlloy) {
              alloyCfg.global.theme = name;
              console.log(
                "Changing " +
                  chalk.cyan("Alloy Theme") +
                  " to " +
                  chalk.yellow(alloyCfg.global.theme),
              );

              if (
                fs.existsSync(
                  "./app/themes/" + alloyCfg.global.theme + "/config.json",
                )
              ) {
                const configTheme = JSON.parse(
                  fs.readFileSync(
                    "./app/themes/" + alloyCfg.global.theme + "/config.json",
                    "utf-8",
                  ),
                );
                console.log(
                  "Updating Alloy config.json with theme configuration file",
                );

                Object.keys(configTheme).forEach(function (rootconfig) {
                  if (alloyCfg[rootconfig]) {
                    Object.keys(configTheme[rootconfig]).forEach(
                      function (innerconfig) {
                        alloyCfg[rootconfig][innerconfig] =
                          configTheme[rootconfig][innerconfig];
                        console.log(
                          "Changing " +
                            chalk.cyan(
                              "config." + rootconfig + "." + innerconfig,
                            ) +
                            " to " +
                            chalk.yellow(configTheme[rootconfig][innerconfig]),
                        );
                      },
                    );
                  }
                });
              }

              fs.writeFileSync(
                "./app/config.json",
                JSON.stringify(alloyCfg, null, 4),
              );
            }

            exec("rm -r ./app/assets/*", function () {
              console.log(chalk.cyan("Assets cleaned"));

              //default assets for all projects
              const globalAssetsDirectory = "./app/themes/global/assets";

              if (fs.existsSync(globalAssetsDirectory)) {
                ncp(globalAssetsDirectory, "./app/assets/", function (err) {
                  if (err) {
                    console.error(err);
                  }

                  console.log(chalk.cyan("Global assets copied"));
                  const assetsDirectory =
                    "./app/themes/" + alloyCfg.global.theme + "/assets/";
                  console.log("Start copy from " + assetsDirectory);

                  if (fs.existsSync(assetsDirectory)) {
                    ncp(assetsDirectory, "./app/assets/", function (err) {
                      if (err) {
                        console.error(err);
                      }

                      console.log(
                        chalk.cyan(alloyCfg.global.theme + " assets copied"),
                      );
                      console.log("Start Platform Assets management");
                      copyThemePlatformAssets();
                    });
                  } else {
                    copyThemePlatformAssets();
                  }
                });
              } else {
                const assetsDirectory =
                  "./app/themes/" + alloyCfg.global.theme + "/assets/";
                console.log("Start copy from " + assetsDirectory);

                if (fs.existsSync(assetsDirectory)) {
                  ncp(assetsDirectory, "./app/assets/", function (err) {
                    if (err) {
                      console.error(err);
                    }

                    console.log(
                      chalk.cyan(alloyCfg.global.theme + " assets copied"),
                    );
                    console.log("Start Platform Assets management");
                    copyThemePlatformAssets();
                  });
                } else {
                  copyThemePlatformAssets();
                }
              }
            });

            console.log(chalk.green("\n" + outfilename + " updated\n"));
            tiapp.write(outfilename);
          }
        }
      });
    }
  }

  // setup CLI
  program
    .version(pkg.version, "-v, --version")
    .usage("[options]")
    .description(pkg.description)
    .option("-l, --list", "Lists the configurations in the project folder")
    .option("-f, --cfgfile <path>", "Specifies the tich config file to use")
    .option(
      "-i, --in <path>",
      "Specifies the file to read (default: tiapp.xml)",
    )
    .option(
      "-o, --out <path>",
      "Specifies the file to write (default: tiapp.xml)",
    )
    .option(
      "-s, --select <name>",
      "Updates TiApp.xml to config specified by <name>",
    )
    .option("--noalloy", "Do no update theme on Alloy config");
  //.option('-c, --capture <name>', "Stores the current values of TiApp.xml id, name, version as <name> ")

  program.parse(process.argv);

  // Handle commander's updated API in newer versions
  const options = program.opts ? program.opts() : program;

  const cfgfile = options.cfgfile ? options.cfgfile : "tich.cfg";
  let infile = options.in ? options.in : "./tiapp.xml";
  const outfile = options.out ? options.out : "./tiapp.xml";
  const processAlloy = options.noalloy ? false : true;

  // check that all required input paths are good
  [cfgfile, infile].forEach(function (file) {
    if (!fs.existsSync(file)) {
      console.log(chalk.red("Cannot find " + file));
      program.help();
    }
  });

  // read in our config
  const cfg = JSON.parse(fs.readFileSync(cfgfile, "utf-8"));

  // check for a new version
  updateNotifier({
    packageName: pkg.name,
    packageVersion: pkg.version,
  }).notify();

  // LIST command - show the list of config items
  if (options.list) {
    cfg.configs.forEach(function (config) {
      console.log(
        chalk.cyan(
          config.name +
            " - " +
            chalk.grey("Name: ") +
            config.settings.name +
            " " +
            chalk.grey("Id: ") +
            config.settings.id +
            " " +
            chalk.grey("Version: ") +
            config.settings.version,
        ),
      );
    });

    // select command, select based on the arg passed
  } else if (options.select) {
    select(options.select, outfile);

    // capture command - this will store the current TiApp.xml settings
  } else if (options.capture) {
    // coming soon!
  } else {
    status();
  }
}
