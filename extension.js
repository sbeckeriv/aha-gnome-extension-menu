const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.misc.util;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const { Shell, GLib, St, GObject, Meta } = imports.gi;

const Soup = imports.gi.Soup;

const ExtensionUtils = imports.misc.extensionUtils;
const ExtDownloader = imports.ui.extensionDownloader;
const ExtManager = Main.extensionManager;
const ExtState = ExtensionUtils.ExtensionState;
const ExtType = ExtensionUtils.ExtensionType;
const gsettings = ExtensionUtils.getSettings();
const Gio = imports.gi.Gio;
const Me = ExtensionUtils.getCurrentExtension();

const SETTINGS_SCHEMA = "org.gnome.shell.extensions.my-work";
/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 */
function getSettings(schema) {
  let extension = ExtensionUtils.getCurrentExtension();

  schema = schema || extension.metadata["settings-schema"];

  const GioSSS = Gio.SettingsSchemaSource;

  // check if this extension was built with "make zip-file", and thus
  // has the schema files in a subfolder
  // otherwise assume that extension has been installed in the
  // same prefix as gnome-shell (and therefore schemas are available
  // in the standard folders)
  let schemaDir = extension.dir.get_child("schemas");
  let schemaSource;
  if (schemaDir.query_exists(null))
    schemaSource = GioSSS.new_from_directory(
      schemaDir.get_path(),
      GioSSS.get_default(),
      false
    );
  else schemaSource = GioSSS.get_default();

  let schemaObj = schemaSource.lookup(schema, true);
  if (!schemaObj)
    throw new Error(
      "Schema " +
        schema +
        " could not be found for extension " +
        extension.metadata.uuid +
        ". Please check your installation."
    );

  return new Gio.Settings({ settings_schema: schemaObj });
}

const Settings = getSettings(SETTINGS_SCHEMA);

function error(message) {
  global.log("[GITHUB NOTIFICATIONS EXTENSION][ERROR] " + message);
}

var PopupScrollMenu = class extends PopupMenu.PopupMenuSection {
  constructor() {
    super();

    this.actor = new St.ScrollView({
      style: "max-height: %dpx".format(global.display.get_size()[1] - 100),
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.NEVER
    });

    this.actor.add_actor(this.box);
    this.actor._delegate = this;
    //this.actor.clip_to_allocation = true;
  }

  _needsScrollbar() {
    let [, topNaturalHeight] = this._getTopMenu().actor.get_preferred_height(
      -1
    );
    //NOTE: return different results in consecutive opens if max-height is monitor's size (1080)
    let topMaxHeight = this.actor.get_theme_node().get_max_height();

    return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
  }

  open() {
    this.emit("open-state-changed", true);
    this._updateMenu();

    let needsScrollbar = this._needsScrollbar();
    this.actor.vscrollbar_policy = needsScrollbar
      ? St.PolicyType.AUTOMATIC
      : St.PolicyType.NEVER;
    needsScrollbar
      ? this.actor.add_style_pseudo_class("scrolled")
      : this.actor.remove_style_pseudo_class("scrolled");
  }
};

const AhaMywork = GObject.registerClass(
  class AhaMyWork extends GObject.Object {
    _init() {
      super._init();
    }

    _fetchSettings() {
      this.domain = Settings.get_string("domain");
      this.token = Settings.get_string("token");
    }

    _addButton() {
      this._button = new PanelMenu.Button(null);
      this._button.add_actor(
        new St.Icon({
          //icon_name: "applications-engineering-symbolic",
          style_class: "system-status-icon aha-icon"
        })
      );
      Main.panel.addToStatusArea(Me.metadata.uuid, this._button);
    }

    _emptyMenuItem() {
      let that = this;
      let item = new PopupMenu.PopupBaseMenuItem({
        style_class: "aha-item"
      });
      item.add_child(
        new St.Label({
          x_expand: true,
          text: "Please configure the domain and token"
        })
      );
      item.add_child(hbox);
      return item;
    }

    _menuItemMaker(ext) {
      let that = this;
      let item = new PopupMenu.PopupBaseMenuItem({
        style_class: "aha-item"
      });
      let toggle = c => {
        try {
          const feature_regex = RegExp(/\w+-\d+/);
          const requirement_regex = RegExp(/\w+-\d+-\d+/);
          let url;
          if (requirement_regex.test(c.reference_num)) {
            url =
              "https://" +
              that.domain +
              ".aha.io/requirements/" +
              c.reference_num;
          } else if (feature_regex.test(c.reference_num)) {
            url =
              "https://" + that.domain + ".aha.io/features/" + c.reference_num;
          } else {
            url =
              "https://" + that.domain + ".aha.io/search?q=" + c.reference_num;
          }
          Gtk.show_uri(null, url, Gtk.get_current_event_time());
        } catch (e) {
          error("Cannot open uri " + e);
        }
      };
      item.connect("activate", () => {
        item._getTopMenu().close();
        toggle(ext);
      });
      item.add_child(
        new St.Label({
          x_expand: true,
          text: "" + ext.reference_num + " " + ext.name
        })
      );
      let hbox = new St.BoxLayout({ x_align: St.Align.START });
      let addButtonItem = (ok, icon, func) => {
        let btn = new St.Button({
          style_class: "aha-prefs-button aha-list-button",
          child: new St.Icon({
            icon_name: icon,
            style_class: "popup-menu-icon",
            style: ok ? "" : "color: transparent;"
          })
        });
        btn.connect("clicked", () => {
          toggle(ext);
        });
        hbox.add_child(btn);
      };
      item.add_child(hbox);
      return item;
    }

    _settingItem() {
      let that = this;
      let item = new PopupMenu.PopupBaseMenuItem({
        style_class: "aha-item",
        hover: false
      });
      let hbox = new St.BoxLayout({ x_align: St.Align.START, x_expand: true });
      let addButtonItem = (icon, func) => {
        let btn = new St.Button({
          hover: true,
          x_expand: true,
          style_class: "aha-list-setting-button aha-list-button",
          child: new St.Icon({
            icon_name: icon,
            style_class: "popup-menu-icon"
          })
        });
        btn.connect("clicked", func);
        hbox.add_child(btn);
      };
      addButtonItem("view-refresh-symbolic", () => {
        that._updateMenu();
      });
      item.add_child(hbox);
      return item;
    }

    _updateMenu() {
      this._button.menu.removeAll();
      let scroll = new PopupScrollMenu();
      if (this.domain != "") {
        let url =
          "https://" +
          this.domain +
          ".aha.io/api/v1/me/assigned?access_token=" +
          this.token;
        this.authUri = new Soup.URI(url);
        this.authManager = new Soup.AuthManager();
        if (this.httpSession) {
          this.httpSession.abort();
        } else {
          this.httpSession = new Soup.Session();
          this.httpSession.user_agent =
            "gnome-shell-extension notification via libsoup";

          Soup.Session.prototype.add_feature.call(
            this.httpSession,
            this.authManager
          );
        }

        let message = new Soup.Message({ method: "GET", uri: this.authUri });
        this.httpSession.queue_message(
          message,
          Lang.bind(this, function(session, response) {
            try {
              if (response.status_code == 200 || response.status_code == 304) {
                if (response.status_code == 200) {
                  let data = JSON.parse(response.response_body.data);
                  var i;
                  for (i = 0; i < data.assigned.length; i++) {
                    let item = data.assigned[i];
                    scroll.addMenuItem(this._menuItemMaker(item));
                  }
                }
                return;
              }
              if (response.status_code == 401) {
                error(
                  "Unauthorized. Check your domain and token in the settings"
                );
                return;
              }
              if (!response.response_body.data && response.status_code > 400) {
                error("HTTP error:" + response.status_code);
                return;
              }
              // if we reach this point, none of the cases above have been triggered
              // which likely means there was an error locally or on the network
              // therefore we should try again in a while
              error("HTTP error:" + response.status_code);
              error("response error: " + JSON.stringify(response));
              return;
            } catch (e) {
              error("HTTP exception:" + e);
              return;
            }
          })
        );
      } else {
        scroll.addMenuItem(this._emptyMenuItem());
      }
      this._button.menu.addMenuItem(scroll);
      this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(""));
      this._button.menu.addMenuItem(this._settingItem());
    }

    enable() {
      this._fetchSettings();
      this._addButton();
      let that = this;
      this._settingId = gsettings.connect("changed", () => {
        this._fetchSettings();
        that._updateMenu();
      });
      this._stateChangeId = ExtManager.connect(
        "extension-state-changed",
        that._updateMenu()
      );
    }

    disable() {
      if (this._settingId)
        gsettings.disconnect(this._settingId), (this._settingId = 0);
      if (this._stateChangeId)
        ExtManager.disconnect(this._stateChangeId), (this._stateChangeId = 0);
      this._button.destroy();
    }
  }
);

function init() {
  return new AhaMywork();
}
