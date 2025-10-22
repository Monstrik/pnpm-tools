const os = require('os');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Resolves the lockfile path - can be absolute or relative to cwd
 */
function resolveLockfilePath(input) {
    if (!input) return null;
    return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
}

/**
 * Finds .npmrc in multiple locations (project root, home directory)
 */
function findNpmrcFiles(lockfilePath) {
    const locations = [
        path.join(os.homedir(), '.npmrc'), // User-level
    ];

    // If lockfile is provided, check for project-level .npmrc
    if (lockfilePath) {
        const projectRoot = path.dirname(lockfilePath);
        locations.unshift(path.join(projectRoot, '.npmrc')); // Project-level takes precedence
    }

    return locations.filter(fs.existsSync);
}

/**
 * Parse .npmrc for default and scoped registry mappings
 * Merges multiple .npmrc files (project overrides home)
 */
function parseNpmrc(filePaths) {
    const registryMap = {};
    let defaultRegistry = 'https://registry.npmjs.org/';

    for (const filePath of filePaths.reverse()) { // Home first, then project overrides
        if (!fs.existsSync(filePath)) continue;

        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        for (const line of lines) {
            const cleanLine = line.trim().split('#')[0]; // Remove comments
            if (!cleanLine) continue;

            // Match scoped registry
            const scopedMatch = cleanLine.match(/^(@[^:]+):registry\s*=\s*(.+)$/);
            if (scopedMatch) {
                const [, scope, registry] = scopedMatch;
                registryMap[scope] = registry.trim();
                continue;
            }

            // Match default registry
            const defaultMatch = cleanLine.match(/^registry\s*=\s*(.+)$/);
            if (defaultMatch) {
                defaultRegistry = defaultMatch[1].trim();
            }
        }
    }

    return { registryMap, defaultRegistry };
}

/**
 * Extract scopes from pnpm-lock.yaml
 */
function extractScopes(lockPath) {
    const scopes = new Set();

    if (!fs.existsSync(lockPath)) {
        throw new Error(`Lockfile not found: ${lockPath}`);
    }

    try {
        const lockData = yaml.load(fs.readFileSync(lockPath, 'utf8'));
        const packages = lockData?.packages || {};

        for (const pkg of Object.keys(packages)) {
            const match = pkg.match(/^(@[^/]+)\//);
            if (match) scopes.add(match[1]);
        }
    } catch (error) {
        throw new Error(`Failed to parse lockfile: ${error.message}`);
    }

    return scopes;
}

/**
 * Format and display the registry summary
 */
function displaySummary(scopes, registryMap, defaultRegistry, npmrcFiles) {
    console.log('📦 Registry Summary');
    console.log('📄 .npmrc files used:');
    npmrcFiles.forEach(file => console.log(`   - ${file}`));
    console.log(`🔧 Default registry: ${defaultRegistry}`);
    console.log('\tOther:');
    Object.entries(registryMap).forEach(([scope, registry]) => {
        console.log(`\t🔧 ${scope} → ${registry}`);
    });

    // console.log(`🔧 Other: ${JSON.stringify(registryMap)}`);
    // console.log(`\n✅ Found ${scopes.size} unique scope(s)`);

    if (scopes.size === 0) {
        console.log('ℹ️  No scoped packages found in lockfile.');
        return;
    }




    // console.log('📋 Scoped packages:');
    // const sortedScopes = Array.from(scopes).sort();
    //
    // for (const scope of sortedScopes) {
    //     const registry = registryMap[scope] || ` (default)`;
    //     console.log(`   ${scope} → ${registry}`);
    // }
    //
    // Filter only scopes that use non-default registry
    const nonDefaultScopes = Array.from(scopes)
        .filter(scope => registryMap[scope])
        .sort();

    if (nonDefaultScopes.length === 0) {
        console.log('✅ All scoped packages use the default registry.');
        return;
    }

    console.log('⚠️  Scopes using non-default registries:');
    for (const scope of nonDefaultScopes) {
        console.log(`   ${scope} → ${registryMap[scope]}`);
    }

    console.log(`\n📊 ${nonDefaultScopes.length} of ${scopes.size} scope(s) use custom registries`);


}

/**
 * Main execution
 */
function main() {
    const lockfileArg = process.argv[2];

    if (!lockfileArg) {
        console.error('❌ Please provide the path to pnpm-lock.yaml as an argument.');
        console.error('\nUsage: node pnpm-registry-summary.js <path-to-pnpm-lock.yaml>');
        console.error('\nExamples:');
        console.error('  node pnpm-registry-summary.js ./pnpm-lock.yaml');
        console.error('  node pnpm-registry-summary.js /absolute/path/to/pnpm-lock.yaml');
        process.exit(1);
    }

    const lockfilePath = resolveLockfilePath(lockfileArg);

    if (!lockfilePath || !fs.existsSync(lockfilePath)) {
        console.error(`❌ Lockfile not found: ${lockfilePath || lockfileArg}`);
        process.exit(1);
    }

    try {
        const npmrcFiles = findNpmrcFiles(lockfilePath);
        const { registryMap, defaultRegistry } = parseNpmrc(npmrcFiles);
        const scopes = extractScopes(lockfilePath);

        displaySummary(scopes, registryMap, defaultRegistry, npmrcFiles);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export for testing
module.exports = {
    parseNpmrc,
    extractScopes,
    resolveLockfilePath,
    findNpmrcFiles
};


// const os = require('os');
// const fs = require('fs');
// const path = require('path');
// const yaml = require('js-yaml');
//
// const lockfilePath = process.argv[2];
// const npmrcPath = path.join(os.homedir(), '.npmrc'); // resolves ~/.npmrc
//
// if (!lockfilePath) {
//     console.error('❌ Please provide the path to pnpm-lock.yaml as an argument.');
//     console.error('Usage: node scope-registry-summary.js <path-to-pnpm-lock.yaml>');
//     process.exit(1);
// }
//
// // Parse .npmrc for default and scoped registry mappings
// function parseNpmrc(filePath) {
//     const registryMap = {};
//     let defaultRegistry = 'Not defined';
//
//     if (!fs.existsSync(filePath)) return { registryMap, defaultRegistry };
//
//     const lines = fs.readFileSync(filePath, 'utf8').split('\n');
//     for (const line of lines) {
//         const cleanLine = line.trim().split('#')[0]; // remove comments
//
//         // Match scoped registry
//         const scopedMatch = cleanLine.match(/^(@[^:]+):registry\s*=\s*(.+)$/);
//         if (scopedMatch) {
//             const [_, scope, registry] = scopedMatch;
//             registryMap[scope] = registry.trim();
//         }
//
//         // Match default registry
//         const defaultMatch = cleanLine.match(/^registry\s*=\s*(.+)$/);
//         if (defaultMatch) {
//             defaultRegistry = defaultMatch[1].trim();
//         }
//     }
//
//     return { registryMap, defaultRegistry };
// }
//
// // Extract scopes from pnpm-lock.yaml
// function extractScopes(lockPath) {
//     const scopes = new Set();
//     if (!fs.existsSync(lockPath)) return scopes;
//
//     const lockData = yaml.load(fs.readFileSync(lockPath, 'utf8'));
//     const packages = lockData?.packages || {};
//
//     for (const pkg of Object.keys(packages)) {
//         const match = pkg.match(/^(@[^/]+)\//);
//         if (match) scopes.add(match[1]);
//     }
//
//     return scopes;
// }
//
// // Run
// const { registryMap, defaultRegistry } = parseNpmrc(npmrcPath);
// const scopes = extractScopes(lockfilePath);
//
// console.log('📦 Registry Summary from .npmrc:\n');
// console.log(`🔧 Default registry → ${defaultRegistry}\n`);
//
// for (const scope of scopes) {
//     const registry = registryMap[scope] || 'Default registry';
//     console.log(`${scope} → ${registry}`);
// }