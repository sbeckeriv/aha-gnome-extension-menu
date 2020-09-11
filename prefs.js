const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

const Config = imports.misc.config;

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

function buildPrefsWidget() {
  const settings = getSettings(SETTINGS_SCHEMA);

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 5
  });

  const tokenBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 5
  });
  const tokenLabel = new Gtk.Label({ label: "Aha Auth Token" });
  tokenBox.pack_start(tokenLabel, false, false, 5);
  const tokenEntry = new Gtk.Entry();
  settings.bind("token", tokenEntry, "text", Gio.SettingsBindFlags.DEFAULT);
  tokenBox.pack_end(tokenEntry, true, true, 5);
  box.pack_start(tokenBox, false, false, 5);

  const domainBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 5
  });
  const domainLabel = new Gtk.Label({ label: "Aha.io Hostname" });
  domainBox.pack_start(domainLabel, false, false, 5);
  const domainEntry = new Gtk.Entry();
  settings.bind("domain", domainEntry, "text", Gio.SettingsBindFlags.DEFAULT);
  domainBox.pack_end(domainEntry, true, true, 5);
  box.pack_start(domainBox, false, false, 5);

  box.show_all();
  return box;
}

function init() {}
