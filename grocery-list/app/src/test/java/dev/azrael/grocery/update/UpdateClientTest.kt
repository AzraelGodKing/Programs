package dev.azrael.grocery.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UpdateClientTest {
    @Test fun readsBuildNumberFromTag() {
        assertEquals(7, UpdateClient.buildNumber("grocery-list-build-7"))
        assertEquals(123, UpdateClient.buildNumber("grocery-list-build-123"))
    }

    @Test fun ignoresOtherProgramsTags() {
        assertNull(UpdateClient.buildNumber("v1.2.0"))
        assertNull(UpdateClient.buildNumber("lantern-build-4"))
        assertNull(UpdateClient.buildNumber("grocery-list-build-x"))
    }
}
