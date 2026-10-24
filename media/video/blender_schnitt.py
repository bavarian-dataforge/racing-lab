"""Builds the Racing Lab video in Blender's Video Sequencer from the screen recordings.

Fixed focus regions instead of tracking: all recordings share the same perspective, only the
browser zoom differs (70 % for takes A-D, 60 % for E-F). The focus boxes are given relative to
the green track area, so the same box works for both zoom levels.

Watch it being built (Blender opens, takes appear one after another; running it again from the
text editor removes the strips of the earlier run and builds anew):
  /Applications/Blender.app/Contents/MacOS/Blender --python media/video/blender_schnitt.py
Build without window and save racing-lab-video.blend:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python media/video/blender_schnitt.py -- --save
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.isdir(HERE) or not os.path.exists(os.path.join(HERE, "take-g-seeds.png")):
    # started from Blender's text editor: take the folder of the opened script file
    HERE = next((os.path.dirname(bpy.path.abspath(t.filepath)) for t in bpy.data.texts
                 if t.filepath.endswith("blender_schnitt.py")), HERE)
FPS, OUT_W, OUT_H = 60, 1920, 1080
SRC_W, SRC_H = 3456, 2234          # screen recording (MacBook, native resolution)
STEP_SECONDS = 1.2                 # pause between takes when building visibly
ZOOM_OUT = (2.0, 0.5)              # seconds before the end of a take: start zooming out, full view reached

# Green track area per browser zoom, measured in the recordings (x0, y0, x1, y1 in pixels)
LAYOUTS = {
    "zoom70": {"grass": (728, 805, 2251, 1986), "telemetry_x": (2285, 2648)},
    "zoom60": {"grass": (880, 734, 2153, 1752), "telemetry_x": (2181, 2495)},
}

# Focus boxes. "overview" = track + telemetry panel. Otherwise (u, v, w): centre as fraction of
# the green area (0..1 from top left) and width as fraction of the green width; height follows 16:9.
FOCUS = {
    "start_corner": (0.22, 0.66, 0.55),     # lower left, where the 80 cars crash in generation 1
    "tight_crash": (0.23, 0.12, 0.45),      # upper left of track 04, inner-wall crash
    "track": (0.5, 0.5, 1.0),               # whole green area
}

# Takes in order: file, zoom, in/out (seconds in the recording), keyframes (second in the take, focus), text
TAKES = [
    ("Take A - Hook.mov", "zoom70", 1.0, 16.0, [(0, "overview"), (3, "track")],
     "122 Gewichte. Eine Trainingsstrecke. Und dann der Nürburgring."),
    ("Take B - Wie es lernt.mov", "zoom70", 6.0, 26.0, [(0, "overview"), (2.5, "start_corner"), (9, "start_corner"), (11, "overview")],
     "80 Autos pro Generation. Die besten vererben ihre Gewichte weiter."),
    ("Take C- Kurve schneiden.mov", "zoom70", 4.0, 15.5, [(0, "overview"), (5, "tight_crash"), (8, "tight_crash"), (10, "overview")],
     "Auf einer neuen Strecke schneidet er die Kurve."),
    ("Take D - Abstand halten.mov", "zoom70", 1.0, 23.0, [(0, "overview"), (4, "track"), (17, "track"), (19, "overview")],
     "Eine Regel: näher als 2,5 m an der Wand kostet Punkte."),
    ("Take E - Rausflug.mov", "zoom60", 1.0, 13.0, [(0, "overview"), (3, "track")],
     "Gleiche Regeln, gleiches Training – Seed 5: raus nach 23 %."),
    ("Teke E - Seed 4 - Volle Runde.mov", "zoom60", 1.0, 19.5, [(0, "track")],
     "Seed 4: volle Runde. Nur der Zufall ist anders."),
    ("Take F - Tight Corners Saubere Runde 19. mov.mov", "zoom60", 0.5, 6.5, [(0, "overview"), (2, "track")],
     "Nach 1 Generation Nürburgring-Training: Runde geschafft."),
    ("Take F- Tigh Corners Crash bei 24,1%.mov", "zoom60", 0.5, 6.9, [(0, "overview"), (1.8, "tight_crash")],
     "Nach 15 Generationen: drei Strecken verlernt."),
]
TAKE_G = ("take-g-seeds.png", 7.0)


def box(layout, focus):
    """Source rectangle (cx, cy, width) for a focus name, always 16:9."""
    gx0, gy0, gx1, gy1 = LAYOUTS[layout]["grass"]
    gw, gh = gx1 - gx0, gy1 - gy0
    if focus == "overview":
        tx1 = LAYOUTS[layout]["telemetry_x"][1]
        x0, x1, y0, y1 = gx0 - 40, tx1 + 40, gy0 - 0.11 * gh, gy1 + 40
        w = max(x1 - x0, (y1 - y0) * 16 / 9)
        return (x0 + x1) / 2, (y0 + y1) / 2, w
    u, v, wf = FOCUS[focus]
    w = max(wf * gw, gh * 16 / 9) if focus == "track" else wf * gw
    return gx0 + u * gw, gy0 + v * gh, w


def strips(scene):
    ed = scene.sequence_editor or scene.sequence_editor_create()
    return ed.strips if hasattr(ed, "strips") else ed.sequences


def set_focus(strip, frame, layout, focus):
    cx, cy, w = box(layout, focus)
    s = bpy.context.scene.render.resolution_x / w   # absolute scale: the source is placed in pixels
    t = strip.transform
    t.scale_x = t.scale_y = s
    t.offset_x = -(cx - SRC_W / 2) * s
    t.offset_y = (cy - SRC_H / 2) * s
    for prop in ("scale_x", "scale_y", "offset_x", "offset_y"):
        t.keyframe_insert(prop, frame=frame)


def add_text(scene, text, start, length):
    st = strips(scene).new_effect(name="Text " + str(start), type="TEXT", channel=3, frame_start=start, length=length)
    st.text, st.font_size = text, 44
    st.use_box, st.box_color, st.box_margin = True, (0.125, 0.22, 0.235, 0.85), 0.012
    st.color = (1, 1, 1, 1)
    st.location = (0.5, 0.07)
    st.alignment_x = st.anchor_x = "CENTER"


def setup(scene):
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = OUT_W, OUT_H, 100
    scene.render.fps, scene.render.fps_base = FPS, 1.0   # fps_base != 1 would shift every focus keyframe
    if hasattr(scene.render.image_settings, "media_type"):   # Blender 5: choose video before the format
        scene.render.image_settings.media_type = "VIDEO"
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format, scene.render.ffmpeg.codec = "MPEG4", "H264"
    scene.render.filepath = os.path.join(HERE, "racing-lab-video.mp4")
    scene.view_settings.view_transform = "Standard"   # screen recordings: no film look, true colours
    strips(scene)


def focus_take(scene, st, take):
    """Focus keyframes on a movie strip; times are seconds in the recording, so trimming does not matter.
    A take that ends zoomed in zooms back out, so the telemetry panel on the right is seen at every cut."""
    _, layout, t_in, t_out, keys, _ = take
    fps = scene.render.fps / scene.render.fps_base
    length = t_out - t_in
    if keys[-1][1] != "overview":
        keys = [k for k in keys if k[0] < length - ZOOM_OUT[0]]   # the zoom-out wins over later keys
        keys += [(length - ZOOM_OUT[0], keys[-1][1]), (length - ZOOM_OUT[1], "overview")]
    for sec, focus in keys:
        set_focus(st, st.frame_start + int((t_in + sec) * fps), layout, focus)


def add_take(scene, i, frame):
    name, layout, t_in, t_out, keys, text = TAKES[i]
    st = strips(scene).new_movie(name=name[:40], filepath=os.path.join(HERE, name), channel=1, frame_start=frame - int(t_in * FPS),
                                 fit_method="ORIGINAL")
    st.frame_offset_start = int(t_in * FPS)
    st.frame_offset_end = max(0, st.frame_duration - int(t_out * FPS))
    start, length = st.frame_final_start, st.frame_final_duration
    focus_take(scene, st, TAKES[i])
    add_text(scene, text, start, length)
    return start + length


def add_take_g(scene, frame):
    path, seconds = TAKE_G
    st = strips(scene).new_image(name="Take G", filepath=os.path.join(HERE, path), channel=1, frame_start=frame, fit_method="FIT")
    st.frame_final_duration = int(seconds * FPS)
    return frame + int(seconds * FPS)


def build_all(scene):
    setup(scene)
    frame = 1
    for i in range(len(TAKES)):
        frame = add_take(scene, i, frame)
    end = add_take_g(scene, frame)
    scene.frame_start, scene.frame_end = 1, end - 1


def build_visibly():
    """One take per timer tick, so the timeline grows in front of the viewer."""
    scene = bpy.context.scene
    setup(scene)
    if scene.animation_data:
        scene.animation_data_clear()   # strips get the same names again: no stale focus keyframes
    state = {"i": 0, "frame": 1}

    def tick():
        if state["i"] < len(TAKES):
            state["frame"] = add_take(scene, state["i"], state["frame"])
        else:
            end = add_take_g(scene, state["frame"])
            scene.frame_start, scene.frame_end = 1, end - 1
            scene.frame_current = 1
            print("Fertig: alle Takes im Sequencer.")
            return None
        scene.frame_end = state["frame"]
        scene.frame_current = state["frame"] - 1
        state["i"] += 1
        return STEP_SECONDS

    bpy.app.timers.register(tick, first_interval=STEP_SECONDS)


def remove_own_strips(scene):
    """Strips from an earlier run (takes, texts, Take G), so a changed TAKES list is rebuilt from scratch."""
    files = {t[0] for t in TAKES}
    col = strips(scene)
    for st in list(col):
        own = (getattr(st, "type", "") == "MOVIE" and os.path.basename(bpy.path.abspath(st.filepath)) in files) \
            or st.name == "Take G" or (getattr(st, "type", "") == "TEXT" and st.name.startswith("Text "))
        if own:
            col.remove(st)


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if bpy.app.background:
    build_all(bpy.context.scene)
    if "--save" in args:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "racing-lab-video.blend"))
else:
    if bpy.context.screen and bpy.context.screen.is_animation_playing:
        bpy.ops.screen.animation_cancel(restore_frame=False)
    remove_own_strips(bpy.context.scene)
    build_visibly()
