package de.unserreiseplaner.app;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "unser_reiseplaner.db";
    private static final int DB_VERSION = 1;

    public DatabaseHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE app_state (state_key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future migrations go here.
    }

    public synchronized void put(String key, String json) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("state_key", key);
        values.put("json", json);
        values.put("updated_at", System.currentTimeMillis());
        db.insertWithOnConflict("app_state", null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public synchronized String get(String key) {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.rawQuery("SELECT json FROM app_state WHERE state_key=?", new String[]{key})) {
            if (cursor.moveToFirst()) return cursor.getString(0);
        }
        return "";
    }
}
