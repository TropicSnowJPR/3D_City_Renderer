import * as THREE from "three";

/**
 * Creates a directional light with shadow properties optimized for a map of the given radius.
 * @param radius - The radius of the map
 * @returns A THREE.DirectionalLight with shadow properties configured for the given map radius
 */
export const createDirectionalLight = function createDirectionalLight(radius: number): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(0xFF_FF_FF, 2);

    light.position.setScalar(radius);
    light.castShadow = true;

    // Choose the nearest power-of-two shadow map size based on map radius, while keeping it within a reasonable quality/performance range
    const mapSize = THREE.MathUtils.clamp(
        2 ** Math.ceil(Math.log2(radius * 8)),
        2048,
        4096,
    );

    // Expand the shadow camera beyond the map radius so all geometry remains inside the shadow frustum
    const extent = radius * 1.5;

    light.shadow.mapSize.set(mapSize, mapSize);

    Object.assign(light.shadow, {
        radius: 3,
        bias: -0.000_05,
        normalBias: 0.02,
    });

    Object.assign(light.shadow.camera, {
        left: -extent,
        right: extent,
        top: extent,
        bottom: -extent,
        near: 1,
        far: radius * 3,
    });

    light.userData.debug = {
        type: "mg:directional_light",
    };

    return light;
}

/**
 * Creates an ambient light with properties optimized for a map scene.
 * @returns A THREE.AmbientLight with properties configured for a map scene
 */
export const createAmbientLight = function createAmbientLight(): THREE.AmbientLight {
    const light = new THREE.AmbientLight(0xFF_FF_FF);

    light.userData.debug = {
        type: "mg:ambient_light",
    }

    return light;
}

/**
 * Creates a hemisphere light with properties optimized for a map scene.
 * @returns A THREE.HemisphereLight with properties configured for a map scene
 */
export const createHemisphereLight = function createHemisphereLight(): THREE.HemisphereLight {
    const light = new THREE.HemisphereLight(0xFF_FF_FF, 0x44_44_44, 1);

    light.position.set(0, 200, 0);

    light.userData.debug = {
        type: "mg:hemisphere_light",
    }

    return light;
}

/**
 * Creates a simple box-shaped skybox with the given radius and color.
 * @param radius - The radius of the map, which determines the size of the skybox by multiplying it with 5
 * @param color - The color of the skybox, which is applied to all faces of the box
 * @returns A THREE.Mesh representing the skybox, with a box geometry and a basic material colored according to the given color.
 */
export const createSkybox = function createSkybox(radius: number, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(5 * radius, 5 * radius, 5 * radius);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.BackSide,
    });

    const skybox = new THREE.Mesh(geometry, material);

    skybox.userData.debug = {
        type: "mg:skybox",
    }

    return skybox;
}

/**
 * Creates a simple cylindrical baseplate with the given radius and color, positioned just below the origin to serve as a ground plane for the map.
 * @param radius - The radius of the map, which determines the size of the baseplate by being used as the radius of the cylinder geometry
 * @param color - The color of the baseplate, which is applied to the material of the mesh
 * @returns A THREE.Mesh representing the baseplate, with a cylinder geometry and a standard material colored according to the given color.
 */
export const createBaseplate = function createBaseplate(radius: number, color: number): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, 5, Math.round(radius / 2), 1);
    const material = new THREE.MeshStandardMaterial({ color: color });

    const baseplate = new THREE.Mesh(geometry, material);

    baseplate.userData.debug = {
        type: "mg:baseplate",
    }

    baseplate.geometry.translate(0, -2.5, 0);
    baseplate.receiveShadow = true;

    return baseplate;
}